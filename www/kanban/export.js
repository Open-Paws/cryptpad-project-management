define([
], function () {
    var module = {
        ext: '.json'
    };

    // Helper to calculate composite score
    var calculateScore = function (scoring) {
        if (!scoring) { return 0; }
        var dimensions = [
            'scale_score', 'impact_magnitude_score', 'longevity_score',
            'multiplication_score', 'foundation_score', 'agi_readiness_score',
            'accessibility_score', 'coalition_building_score', 'pillar_coverage_score',
            'build_feasibility_score'
        ];
        var sum = 0;
        var count = 0;
        dimensions.forEach(function (dim) {
            if (scoring[dim] > 0) {
                sum += scoring[dim];
                count++;
            }
        });
        return count > 0 ? (sum / dimensions.length).toFixed(1) : '0';
    };

    // CSV export
    module.toCSV = function (content) {
        var data = content.data || {};
        var items = content.items || {};
        var rows = [];

        // Header row
        rows.push(['Project', 'Status', 'Assignee', 'Due Date', 'Score', 'Tasks'].join(','));

        // Build board name lookup
        var boardNames = {};
        Object.keys(data).forEach(function (boardId) {
            boardNames[boardId] = data[boardId].title || 'Unknown';
            (data[boardId].item || []).forEach(function (itemId) {
                if (items[itemId]) {
                    items[itemId]._boardId = boardId;
                }
            });
        });

        // Export each item
        Object.keys(items).forEach(function (itemId) {
            var item = items[itemId];
            var status = boardNames[item._boardId] || 'Unknown';
            var tasks = item.tasks || [];
            var completedTasks = tasks.filter(function (t) { return t.done; }).length;
            var taskProgress = tasks.length > 0 ? (completedTasks + '/' + tasks.length) : '0/0';

            var row = [
                '"' + (item.title || '').replace(/"/g, '""') + '"',
                '"' + status + '"',
                '"' + (item.assignee || '').replace(/"/g, '""') + '"',
                '"' + (item.due_date || '') + '"',
                calculateScore(item.scoring),
                '"' + taskProgress + '"'
            ];
            rows.push(row.join(','));
        });

        return rows.join('\n');
    };

    module.main = function (userDoc, cb) {
        var content = userDoc.content;
        cb(new Blob([JSON.stringify(content, 0, 2)], {
            type: 'application/json',
        }));
    };

    module.import = function (content) {
        // Import from Trello

        var c = {
            data: {},
            items: {},
            list: []
        };

        var colorMap = {
            red: 'color1',
            orange: 'color2',
            yellow: 'color3',
            lime: 'color4',
            green: 'color5',
            sky: 'color6',
            blue: 'color7',
            purple: 'color8',
            pink: 'color9',
            black: 'nocolor'
        };
        content.cards.forEach(function (obj, i) {
            var tags;
            var color;
            if (Array.isArray(obj.labels)) {
                obj.labels.forEach(function (l) {
                    if (!color) {
                        color = colorMap[l.color] || '';
                    }
                    if (l.name) {
                        tags = tags || [];
                        var n = l.name.toLowerCase().trim();
                        if (tags.indexOf(n) === -1) { tags.push(n); }
                    }
                });
            }
            c.items[(i + 1)] = {
                id: (i + 1),
                title: obj.name,
                body: obj.desc,
                color: color,
                tags: tags
            };
        });

        var id = 1;
        content.lists.forEach(function (obj) {
            var _id = obj.id;
            var cards = [];
            content.cards.forEach(function (card, i) {
                if (card.idList === _id) {
                    cards.push(i + 1);
                }
            });
            c.data[id] = {
                id: id,
                title: obj.name,
                item: cards
            };
            c.list.push(id);

            id++;
        });

        return c;
    };

    return module;
});

