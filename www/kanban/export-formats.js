// SPDX-FileCopyrightText: 2026 Open Paws
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Export formatting module for CryptPad Kanban.
// Provides JSON and Markdown formatters for cards, columns, and filtered views.
// All functions operate on plaintext data already decrypted client-side.
define([], function () {
    var module = {};

    // Scoring dimension key -> human-readable label mapping
    var DIMENSION_LABELS = {
        'scale_score': 'Scale',
        'impact_magnitude_score': 'Impact Magnitude',
        'longevity_score': 'Longevity',
        'multiplication_score': 'Multiplication',
        'foundation_score': 'Foundation',
        'agi_readiness_score': 'Future-Readiness',
        'accessibility_score': 'Accessibility',
        'coalition_building_score': 'Coalition Building',
        'pillar_coverage_score': 'Coverage',
        'build_feasibility_score': 'Build Feasibility'
    };

    var DIMENSION_KEYS = Object.keys(DIMENSION_LABELS);

    // Valid security tier values
    var VALID_TIERS = ['T1', 'T2', 'T3'];

    // Check if a board's item array contains a given ID (handles numeric IDs)
    var boardContainsItem = function (board, itemId) {
        if (!board || !Array.isArray(board.item)) { return false; }
        return board.item.some(function (boardItemId) {
            return String(boardItemId) === itemId;
        });
    };

    // Resolve effective tier for an item
    var resolveEffectiveTier = function (item, boardData) {
        if (item.tier && VALID_TIERS.indexOf(item.tier) !== -1) {
            return { effective: item.tier, source: 'card', explicit: item.tier };
        }
        var itemId = String(item.id);
        var keys = Object.keys(boardData || {});
        for (var i = 0; i < keys.length; i++) {
            var board = boardData[keys[i]];
            if (boardContainsItem(board, itemId)) {
                if (board.tier && VALID_TIERS.indexOf(board.tier) !== -1) {
                    return { effective: board.tier, source: 'column', explicit: null };
                }
                break;
            }
        }
        return { effective: null, source: 'unclassified', explicit: null };
    };

    // Find which column an item belongs to
    var findColumnForItem = function (item, boardData) {
        var itemId = String(item.id);
        var keys = Object.keys(boardData || {});
        for (var i = 0; i < keys.length; i++) {
            var board = boardData[keys[i]];
            if (boardContainsItem(board, itemId)) {
                return board.title || 'Unknown';
            }
        }
        return 'Unknown';
    };

    // Check if a referenced item is exportable (not hidden, not T3)
    var isItemExportable = function (itemId, allItems, boardData) {
        var item = allItems[itemId];
        if (!item) { return false; }
        if (item.hidden) { return false; }
        var tier = resolveEffectiveTier(item, boardData);
        return tier.effective !== 'T3';
    };

    // Build reverse dependency map: itemId -> [ids that depend on it]
    var buildReverseDeps = function (allItems) {
        var reverseMap = {};
        Object.keys(allItems).forEach(function (id) {
            var item = allItems[id];
            if (Array.isArray(item.dependencies)) {
                item.dependencies.forEach(function (depId) {
                    reverseMap[depId] = reverseMap[depId] || [];
                    reverseMap[depId].push(id);
                });
            }
        });
        return reverseMap;
    };

    // Compute composite score
    var computeComposite = function (scoring) {
        if (!scoring) { return 0; }
        var total = 0;
        DIMENSION_KEYS.forEach(function (key) {
            total += (scoring[key] || 0);
        });
        return Math.round((total / DIMENSION_KEYS.length) * 10) / 10;
    };

    // Filter out T3 and hidden items from export data.
    // Returns { filtered: [], excludedT3: number, excludedHidden: number, unclassifiedCount: number }
    var filterForExport = function (items, context) {
        var filtered = [];
        var excludedT3 = 0;
        var excludedHidden = 0;
        var unclassifiedCount = 0;
        items.forEach(function (item) {
            if (item.hidden) { excludedHidden++; return; }
            var tier = resolveEffectiveTier(item, context.boardData);
            if (tier.effective === 'T3') { excludedT3++; return; }
            if (tier.effective === null) { unclassifiedCount++; }
            filtered.push(item);
        });
        return { filtered: filtered, excludedT3: excludedT3, excludedHidden: excludedHidden, unclassifiedCount: unclassifiedCount };
    };

    // Format a single card as a JSON-ready object
    var formatCardObject = function (item, context) {
        var boardData = context.boardData || {};
        var allItems = context.allItems || {};
        var reverseDeps = context._reverseDeps || buildReverseDeps(allItems);

        var tier = resolveEffectiveTier(item, boardData);
        var column = findColumnForItem(item, boardData);

        // Resolve dependency titles (filter out hidden/T3 references)
        var dependsOn = [];
        var dependsOnIds = [];
        (item.dependencies || []).forEach(function (depId) {
            if (!isItemExportable(depId, allItems, boardData)) { return; }
            dependsOnIds.push(String(depId));
            var dep = allItems[depId];
            dependsOn.push(dep ? dep.title : ('Unknown (' + depId + ')'));
        });

        // Reverse deps (filter out hidden/T3 references)
        var blocks = [];
        (reverseDeps[String(item.id)] || []).forEach(function (bid) {
            if (!isItemExportable(bid, allItems, boardData)) { return; }
            var dep = allItems[bid];
            blocks.push(dep ? dep.title : ('Unknown (' + bid + ')'));
        });

        // Scoring
        var scoringObj = null;
        if (item.scoring) {
            var dimensions = {};
            DIMENSION_KEYS.forEach(function (key) {
                dimensions[DIMENSION_LABELS[key]] = item.scoring[key] || 0;
            });
            scoringObj = {
                composite: computeComposite(item.scoring),
                dimensions: dimensions
            };
        }

        // Tasks (exclude hidden and recurrence instances)
        var tasks = [];
        if (Array.isArray(item.tasks)) {
            item.tasks.forEach(function (task) {
                if (task.hidden || task.isRecurrenceInstance) { return; }
                var taskDeps = [];
                (task.dependencies || []).forEach(function (tid) {
                    var t = item.tasks.find(function (tt) { return tt.id === tid; });
                    if (t && (t.hidden || t.isRecurrenceInstance)) { return; }
                    taskDeps.push(t ? t.title : tid);
                });
                var taskObj = {
                    title: task.title || '',
                    assignee: task.assignee || '',
                    done: !!task.done,
                    due_date: task.due_date || null,
                    start_date: task.start_date || null,
                    recurrence: task.recurrence || null,
                    dependencies: taskDeps.length > 0 ? taskDeps : undefined
                };
                tasks.push(taskObj);
            });
        }

        // Comments (export name only, not curvePublic key)
        var comments = [];
        if (Array.isArray(item.comments)) {
            item.comments.slice().sort(function (a, b) { return b.time - a.time; }).forEach(function (c) {
                var commentObj = {
                    author: c.name || 'Anonymous',
                    text: c.text || '',
                    time: c.time ? new Date(c.time).toISOString() : null,
                    reactions: {},
                    replyTo: c.replyTo ? { name: c.replyTo.name, text: c.replyTo.text } : null
                };
                if (c.reactions) {
                    Object.keys(c.reactions).forEach(function (emoji) {
                        var users = c.reactions[emoji] || [];
                        if (users.length > 0) {
                            commentObj.reactions[emoji] = users.length;
                        }
                    });
                }
                comments.push(commentObj);
            });
        }

        return {
            title: item.title || '',
            column: column,
            tier: tier,
            assignee: item.assignee || '',
            start_date: item.start_date || null,
            due_date: item.due_date || null,
            completed: !!item.completed,
            createdBy: item.createdBy || '',
            tags: Array.isArray(item.tags) ? item.tags : [],
            description: item.body || '',
            scoring: scoringObj,
            tasks: tasks.length > 0 ? tasks : undefined,
            dependencies: {
                depends_on: dependsOn.length > 0 ? dependsOn : undefined,
                depends_on_ids: dependsOnIds.length > 0 ? dependsOnIds : undefined,
                blocks: blocks.length > 0 ? blocks : undefined
            },
            comments: comments.length > 0 ? comments : undefined
        };
    };

    // --- JSON formatters ---

    module.formatCardJSON = function (item, context) {
        // Guard: never export hidden or T3 items even via single-card API
        if (item.hidden) { return null; }
        var tier = resolveEffectiveTier(item, context.boardData || {});
        if (tier.effective === 'T3') { return null; }
        context._reverseDeps = buildReverseDeps(context.allItems || {});
        var obj = formatCardObject(item, context);
        return JSON.stringify(obj, null, 2);
    };

    module.formatMultiJSON = function (items, context) {
        context._reverseDeps = buildReverseDeps(context.allItems || {});
        var result = filterForExport(items, context);
        var cards = result.filtered.map(function (item) {
            return formatCardObject(item, context);
        });
        var wrapper = {
            exported: new Date().toISOString(),
            source: context.sourceLabel || 'Board',
            filters_active: context.activeFilters || {},
            card_count: cards.length,
            cards: cards
        };
        return {
            json: JSON.stringify(wrapper, null, 2),
            excludedT3: result.excludedT3,
            excludedHidden: result.excludedHidden,
            unclassifiedCount: result.unclassifiedCount,
            exportedCount: cards.length
        };
    };

    // --- Markdown formatters ---

    var formatCardMarkdownBody = function (item, context) {
        var boardData = context.boardData || {};
        var allItems = context.allItems || {};
        var reverseDeps = context._reverseDeps || buildReverseDeps(allItems);

        var tier = resolveEffectiveTier(item, boardData);
        var column = findColumnForItem(item, boardData);
        var lines = [];

        lines.push('# ' + (item.title || 'Untitled'));
        lines.push('');

        // Metadata table
        lines.push('| Field | Value |');
        lines.push('|-------|-------|');
        lines.push('| Column | ' + column + ' |');
        lines.push('| Tier | ' + (tier.effective || 'Unclassified') + ' (' + tier.source + ') |');
        lines.push('| Assignee | ' + (item.assignee || '\u2014') + ' |');
        lines.push('| Start | ' + (item.start_date || '\u2014') + ' |');
        lines.push('| Due | ' + (item.due_date || '\u2014') + ' |');
        lines.push('| Completed | ' + (item.completed ? 'Yes' : 'No') + ' |');
        var composite = computeComposite(item.scoring);
        lines.push('| Score | ' + composite + '/10 |');
        lines.push('| Created by | ' + (item.createdBy || '\u2014') + ' |');
        lines.push('| Tags | ' + (Array.isArray(item.tags) && item.tags.length > 0 ? item.tags.join(', ') : '\u2014') + ' |');
        lines.push('');

        // Description
        if (item.body) {
            lines.push('## Description');
            lines.push('');
            lines.push(item.body);
            lines.push('');
        }

        // Scoring breakdown
        if (item.scoring && composite > 0) {
            lines.push('## Impact Scoring (' + composite + '/10)');
            lines.push('');
            lines.push('| Dimension | Score |');
            lines.push('|-----------|-------|');
            DIMENSION_KEYS.forEach(function (key) {
                lines.push('| ' + DIMENSION_LABELS[key] + ' | ' + (item.scoring[key] || 0) + '/10 |');
            });
            lines.push('');
        }

        // Subtasks
        if (Array.isArray(item.tasks) && item.tasks.length > 0) {
            var visibleTasks = item.tasks.filter(function (t) { return !t.hidden && !t.isRecurrenceInstance; });
            if (visibleTasks.length > 0) {
                var doneCount = visibleTasks.filter(function (t) { return t.done; }).length;
                lines.push('## Subtasks (' + doneCount + '/' + visibleTasks.length + ' complete)');
                lines.push('');
                visibleTasks.forEach(function (task) {
                    var parts = [];
                    if (task.assignee) { parts.push('@' + task.assignee); }
                    if (task.due_date) { parts.push('due ' + task.due_date); }
                    if (task.recurrence && task.recurrence.type) {
                        parts.push('recurs ' + task.recurrence.type + (task.recurrence.interval > 1 ? ' every ' + task.recurrence.interval : ''));
                    }
                    if (Array.isArray(task.dependencies) && task.dependencies.length > 0) {
                        var depNames = [];
                        task.dependencies.forEach(function (tid) {
                            var t = item.tasks.find(function (tt) { return tt.id === tid; });
                            if (t && (t.hidden || t.isRecurrenceInstance)) { return; }
                            depNames.push(t ? t.title : tid);
                        });
                        if (depNames.length > 0) { parts.push('depends on: ' + depNames.join(', ')); }
                    }
                    var suffix = parts.length > 0 ? ' (' + parts.join(', ') + ')' : '';
                    lines.push('- [' + (task.done ? 'x' : ' ') + '] ' + (task.title || 'Untitled') + suffix);
                });
                lines.push('');
            }
        }

        // Dependencies (filter out hidden/T3 references)
        var dependsOn = [];
        (item.dependencies || []).forEach(function (depId) {
            if (!isItemExportable(depId, allItems, boardData)) { return; }
            var dep = allItems[depId];
            dependsOn.push(dep ? dep.title : depId);
        });
        var blocks = [];
        (reverseDeps[String(item.id)] || []).forEach(function (bid) {
            if (!isItemExportable(bid, allItems, boardData)) { return; }
            var dep = allItems[bid];
            blocks.push(dep ? dep.title : bid);
        });
        if (dependsOn.length > 0 || blocks.length > 0) {
            lines.push('## Dependencies');
            lines.push('');
            if (dependsOn.length > 0) {
                lines.push('**Depends on:** ' + dependsOn.join(', '));
            }
            if (blocks.length > 0) {
                lines.push('**Blocks:** ' + blocks.join(', '));
            }
            lines.push('');
        }

        // Comments
        if (Array.isArray(item.comments) && item.comments.length > 0) {
            var sorted = item.comments.slice().sort(function (a, b) { return b.time - a.time; });
            lines.push('## Comments (' + sorted.length + ')');
            lines.push('');
            sorted.forEach(function (c) {
                var dateStr = c.time ? new Date(c.time).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : '';
                lines.push('**' + (c.name || 'Anonymous') + '** \u2014 ' + dateStr);
                if (c.replyTo) {
                    lines.push('> Re: ' + (c.replyTo.name || 'Anonymous') + ': ' + (c.replyTo.text || '').substring(0, 100));
                }
                lines.push('> ' + (c.text || '').split('\n').join('\n> '));
                lines.push('');
            });
        }

        return lines.join('\n');
    };

    module.formatCardMarkdown = function (item, context) {
        // Guard: never export hidden or T3 items even via single-card API
        if (item.hidden) { return null; }
        var tier = resolveEffectiveTier(item, context.boardData || {});
        if (tier.effective === 'T3') { return null; }
        context._reverseDeps = buildReverseDeps(context.allItems || {});
        return formatCardMarkdownBody(item, context);
    };

    module.formatMultiMarkdown = function (items, context) {
        context._reverseDeps = buildReverseDeps(context.allItems || {});
        var result = filterForExport(items, context);
        var lines = [];

        lines.push('# Export: ' + (context.sourceLabel || 'Board'));
        lines.push('**Exported:** ' + new Date().toISOString());
        lines.push('**Cards:** ' + result.filtered.length);

        // Human-readable filter description
        var filterParts = [];
        var af = context.activeFilters || {};
        if (af.assignee) { filterParts.push('Assignee: ' + af.assignee); }
        if (af.status) { filterParts.push('Status: ' + af.status); }
        if (af.minScore > 0) { filterParts.push('Score \u2265 ' + af.minScore); }
        if (af.duePreset) { filterParts.push('Due: ' + af.duePreset); }
        if (af.tier) { filterParts.push('Tier: ' + af.tier); }
        lines.push('**Filters:** ' + (filterParts.length > 0 ? filterParts.join(', ') : 'None'));
        lines.push('');

        result.filtered.forEach(function (item, i) {
            if (i > 0) { lines.push('---'); lines.push(''); }
            lines.push(formatCardMarkdownBody(item, context));
        });

        return {
            markdown: lines.join('\n'),
            excludedT3: result.excludedT3,
            excludedHidden: result.excludedHidden,
            unclassifiedCount: result.unclassifiedCount,
            exportedCount: result.filtered.length
        };
    };

    // My Tasks view export (subtask-centric format)
    module.formatTasksMarkdown = function (taskDescriptors, context) {
        var boardData = context.boardData || {};
        var allItems = context.allItems || {};
        var lines = [];

        lines.push('# My Tasks Export');
        lines.push('**Exported:** ' + new Date().toISOString());

        var filterParts = [];
        var af = context.activeFilters || {};
        if (af.assignee) { filterParts.push('Assignee: ' + af.assignee); }
        if (af.status) { filterParts.push('Status: ' + af.status); }
        if (af.duePreset) { filterParts.push('Due: ' + af.duePreset); }
        if (af.tier) { filterParts.push('Tier: ' + af.tier); }
        lines.push('**Filters:** ' + (filterParts.length > 0 ? filterParts.join(', ') : 'None'));

        // Filter out T3 parent projects (count unique projects, not tasks)
        var excludedT3Projects = {};
        var filtered = taskDescriptors.filter(function (td) {
            var parentItem = allItems[td.projectId];
            if (!parentItem) { return false; }
            if (parentItem.hidden) { return false; }
            var tier = resolveEffectiveTier(parentItem, boardData);
            if (tier.effective === 'T3') {
                excludedT3Projects[td.projectId] = true;
                return false;
            }
            return true;
        });
        var excludedT3 = Object.keys(excludedT3Projects).length;

        lines.push('**Tasks:** ' + filtered.length);
        lines.push('');

        // Group by parent project
        var byProject = {};
        var projectOrder = [];
        filtered.forEach(function (td) {
            if (!byProject[td.projectId]) {
                byProject[td.projectId] = [];
                projectOrder.push(td.projectId);
            }
            byProject[td.projectId].push(td);
        });

        projectOrder.forEach(function (pid) {
            var tds = byProject[pid];
            var parentItem = allItems[pid];
            if (!parentItem) { return; }
            var tier = resolveEffectiveTier(parentItem, boardData);
            var column = findColumnForItem(parentItem, boardData);
            var score = computeComposite(parentItem.scoring);

            var headerParts = [tier.effective || 'Unclassified', 'Column: ' + column, 'Score: ' + score + '/10'];
            lines.push('## ' + (parentItem.title || 'Untitled') + ' (' + headerParts.join(', ') + ')');
            lines.push('');

            tds.forEach(function (td) {
                var task = td.task;
                if (task.hidden || task.isRecurrenceInstance) { return; }
                var parts = [];
                if (task.assignee) { parts.push('@' + task.assignee); }
                if (task.due_date) { parts.push('due ' + task.due_date); }
                if (task.recurrence && task.recurrence.type) {
                    parts.push('recurs ' + task.recurrence.type);
                }
                var suffix = parts.length > 0 ? ' (' + parts.join(', ') + ')' : '';
                lines.push('- [' + (task.done ? 'x' : ' ') + '] ' + (task.title || 'Untitled') + suffix);
            });
            lines.push('');
        });

        return {
            markdown: lines.join('\n'),
            excludedT3: excludedT3,
            exportedCount: filtered.length
        };
    };

    // Expose helpers for use by the main module
    module.filterForExport = filterForExport;
    module.resolveEffectiveTier = resolveEffectiveTier;
    module.computeComposite = computeComposite;

    return module;
});
