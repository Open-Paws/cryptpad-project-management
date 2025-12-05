// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

define([
    'jquery',
    'json.sortify',
    '/components/nthen/index.js',
    '/common/sframe-common.js',
    '/common/sframe-app-framework.js',
    '/common/sframe-common-codemirror.js',
    '/common/common-util.js',
    '/common/common-hash.js',
    '/common/common-interface.js',
    '/common/common-ui-elements.js',
    '/common/inner/common-mediatag.js',
    '/customize/messages.js',
    '/common/hyperscript.js',
    '/common/text-cursor.js',
    '/common/diffMarked.js',
    '/components/chainpad/chainpad.dist.js',
    'cm/lib/codemirror',
    '/kanban/jkanban_cp.js',
    '/kanban/export.js',
    '/common/TypingTests.js',

    'cm/mode/gfm/gfm',
    'cm/addon/edit/closebrackets',
    'cm/addon/edit/matchbrackets',
    'cm/addon/edit/trailingspace',
    'cm/addon/selection/active-line',
    'cm/addon/search/search',
    'cm/addon/search/match-highlighter',

    'css!/components/codemirror/lib/codemirror.css',
    'css!/components/codemirror/addon/dialog/dialog.css',
    'css!/components/codemirror/addon/fold/foldgutter.css',
    'less!/kanban/app-kanban.less'
], function (
    $,
    Sortify,
    nThen,
    SFCommon,
    Framework,
    SFCodeMirror,
    Util,
    Hash,
    UI,
    UIElements,
    MT,
    Messages,
    h,
    TextCursor,
    DiffMd,
    ChainPad,
    CodeMirror,
    jKanban,
    Export,
    TypingTest)
{

    var verbose = function (x) { console.log(x); };
    verbose = function () {}; // comment out to enable verbose logging
    var onRedraw = Util.mkEvent();
    var onCursorUpdate = Util.mkEvent();
    var remoteCursors = {};

    let getCursor = () => {};
    let restoreCursor = () => {};

    var setValueAndCursor = function (input, val, _cursor) {
        if (!input) { return; }
        var $input = $(input);
        var focus = _cursor || $input.is(':focus');
        var oldVal = $input.val();
        var ops = ChainPad.Diff.diff(_cursor ? _cursor.value : oldVal, val);

        var cursor = _cursor || input;

        var selects = ['selectionStart', 'selectionEnd'].map(function (attr) {
            return TextCursor.transformCursor(cursor[attr], ops);
        });
        $input.val(val);
        if (focus) { $input.focus(); }
        input.selectionStart = selects[0];
        input.selectionEnd = selects[1];
    };

    var getTextColor = function (hex) {
        if (hex && /^#/.test(hex)) { hex = hex.slice(1); }
        if (!/^[0-9a-f]{6}$/i.test(hex)) {
            return '#000000';
        }
        var r = parseInt(hex.slice(0,2), 16);
        var g = parseInt(hex.slice(2,4), 16);
        var b = parseInt(hex.slice(4,6), 16);
        if ((r*0.213 + g*0.715 + b*0.072) > 255/2) {
            return '#000000';
        }
        return '#FFFFFF';
    };

    var getAvatar = function (cursor, noClear) {
        // Tippy
        var html = MT.getCursorAvatar(cursor);

        var name = UI.getDisplayName(cursor.name);

        var l; // label?
        var animal = '';
        if (cursor.name === Messages.anonymous && typeof(cursor.uid) === 'string') {
            l = MT.getPseudorandomAnimal(cursor.uid);
            if (l) {
                animal = '.animal';
            }
        }
        if (!l) {
            l = MT.getPrettyInitials(name);
        }

        var text = '';
        if (cursor.color) {
            text = 'background-color:' + cursor.color + '; color:'+getTextColor(cursor.color)+';';
        }
        var avatar = h('span.cp-cursor.cp-tippy-html' + animal, {
            style: text,
            'data-cptippy-html': true,
            title: html,
        }, l);
        if (!noClear) {
            cursor.clear = function () {
                $(avatar).remove();
            };
        }
        return avatar;
    };

    var getExistingTags = function (boards) {
        var tags = [];
        boards = boards || {};
        Object.keys(boards.items || {}).forEach(function (id) {
            var data = boards.items[id];
            if (!Array.isArray(data.tags)) { return; }
            data.tags.forEach(function (_tag) {
                var tag = _tag.toLowerCase();
                if (tags.indexOf(tag) === -1) { tags.push(tag); }
            });
        });
        tags.sort();
        return tags;
    };

    var addEditItemButton = function () {};
    var addMoveElementButton = function () {};

    var onRemoteChange = Util.mkEvent();
    var now = function () { return +new Date(); };
    var _lastUpdate = 0;
    var _updateBoards = function (framework, kanban, boards) {
        _lastUpdate = now();
        var cursor = getCursor();
        kanban.setBoards(Util.clone(boards));
        kanban.inEditMode = false;
        addEditItemButton(framework, kanban);
        addMoveElementButton(framework, kanban);
        restoreCursor(cursor);
        onRemoteChange.fire();
    };
    var _updateBoardsThrottle = Util.throttle(_updateBoards, 1000);
    var updateBoards = function (framework, kanban, boards) {
        if ((now() - _lastUpdate) > 5000 || framework.isLocked()) {
            _updateBoards(framework, kanban, boards);
            return;
        }
        _updateBoardsThrottle(framework, kanban, boards);
    };
    var editModal;
    var PROPERTIES = ['title', 'body', 'tags', 'color', 'assignee', 'start_date', 'due_date', 'scoring', 'tasks', 'createdBy', 'dependencies', 'completed'];
    var BOARD_PROPERTIES = ['title', 'color'];

    // Task helper function
    var createTask = function (title, assignee, createdBy) {
        return {
            id: Util.createRandomInteger(),
            title: title || '',
            assignee: assignee || '',
            done: false,
            createdBy: createdBy || '',
            start_date: '',
            due_date: '',
            dependencies: []
        };
    };
    var createEditModal = function (framework, kanban) {
        if (framework.isReadOnly()) { return; }
        if (editModal) { return editModal; }

        var dataObject = {};
        var isBoard, id;
        var offline = false;

        var update = function () {
            updateBoards(framework, kanban, kanban.options.boards);
        };

        var saveIndicatorTimeout;
        var flashSaveIndicator = function () {
            var $indicator = $('.cp-kanban-autosave-indicator');
            if ($indicator.length) {
                clearTimeout(saveIndicatorTimeout);
                $indicator.addClass('visible');
                saveIndicatorTimeout = setTimeout(function () {
                    $indicator.removeClass('visible');
                }, 1500);
            }
        };

        var commit = function () {
            framework.localChange();
            update();
            flashSaveIndicator();
        };

        var colors = UIElements.makePalette(8, color => {
            dataObject.color = color;
            commit();
        });

        var markdownEditorWrapper = h('div.cp-markdown-label-row');

        var conflicts, conflictContainer, titleInput, tagsDiv, text, assigneeInput, startDateInput, dueDateInput, tasksContainer, completedToggle;
        var scoringSliders = {};
        
        // Create scoring dimension sliders
        var scoringDimensions = [
            { key: 'scale_score', label: 'Scale - Number of animals/advocates affected' },
            { key: 'impact_magnitude_score', label: 'Impact Magnitude - Depth of positive change' },
            { key: 'longevity_score', label: 'Longevity - Lasting value over time' },
            { key: 'multiplication_score', label: 'Multiplication - Enables additional impact' },
            { key: 'foundation_score', label: 'Foundation - Creates platform for future work' },
            { key: 'agi_readiness_score', label: 'Future-Readiness - Adapts to changing landscape' },
            { key: 'accessibility_score', label: 'Accessibility - Easy for advocates to adopt' },
            { key: 'coalition_building_score', label: 'Coalition Building - Strengthens movement unity' },
            { key: 'pillar_coverage_score', label: 'Coverage - Impact across advocacy approaches' },
            { key: 'build_feasibility_score', label: 'Build Feasibility - Speed and ease of implementation' }
        ];
        
        // Composite score display with progress bar (always visible)
        var scoreProgressBar = h('div.cp-kanban-score-progress-bar');
        var scoreProgressContainer = h('div.cp-kanban-score-progress-container', [scoreProgressBar]);
        var compositeScoreDisplay = h('span.cp-kanban-composite-score', '0/10');
        var scoringExpandIcon = h('i.fa.fa-chevron-down');
        var scoringExpandText = h('span', ' Expand');
        var scoringExpandBtn = h('button.btn.btn-secondary.cp-kanban-scoring-expand', [
            scoringExpandIcon,
            scoringExpandText
        ]);
        var scoringHeader = h('div.cp-kanban-scoring-header', [
            h('span.cp-kanban-section-label', [
                h('i.fa.fa-star'),
                ' Score:'
            ]),
            scoreProgressContainer,
            compositeScoreDisplay,
            scoringExpandBtn
        ]);

        // Detailed scoring sliders (collapsible)
        var scoringDetails = [];
        scoringDimensions.forEach(function(dim) {
            var slider = h('input', {
                type: 'range',
                min: '0',
                max: '10',
                value: '0',
                class: 'cp-kanban-scoring-slider',
                id: 'cp-kanban-' + dim.key
            });
            var valueDisplay = h('span', { class: 'cp-kanban-score-value' }, '0');

            scoringDetails.push(h('div', { class: 'cp-kanban-scoring-row' }, [
                h('label', { for: 'cp-kanban-' + dim.key, class: 'cp-kanban-scoring-label' }, dim.label),
                h('div', { class: 'cp-kanban-scoring-input' }, [
                    slider,
                    valueDisplay
                ])
            ]));

            scoringSliders[dim.key] = { slider: slider, display: valueDisplay };
        });

        var scoringDetailsContainer = h('div.cp-kanban-scoring-details', scoringDetails);
        var $scoringDetailsContainer = $(scoringDetailsContainer);
        $scoringDetailsContainer.hide(); // Collapsed by default

        var scoringExpanded = false;
        $(scoringExpandBtn).on('click', function() {
            scoringExpanded = !scoringExpanded;
            $scoringDetailsContainer.slideToggle(150);
            $(scoringExpandIcon).toggleClass('fa-chevron-down', !scoringExpanded);
            $(scoringExpandIcon).toggleClass('fa-chevron-up', scoringExpanded);
            $(scoringExpandText).text(scoringExpanded ? ' Collapse' : ' Expand');
        });

        var scoringElements = [scoringHeader, scoringDetailsContainer];
        
        var content = h('div.cp-kanban-modal-content', [
            // Conflicts warning
            conflictContainer = h('div#cp-kanban-edit-conflicts', [
                h('div', Messages.kanban_conflicts),
                conflicts = h('div.cp-kanban-cursors')
            ]),

            // ===== GROUP 1: Primary Content =====
            h('div.cp-kanban-modal-group.cp-kanban-group-primary', [
                h('label.cp-kanban-section-label', { for: 'cp-kanban-edit-title' }, [
                    h('i.fa.fa-heading'),
                    ' Title'
                ]),
                titleInput = h('input#cp-kanban-edit-title', { placeholder: 'Enter project title...' }),

                h('div.cp-kanban-tasks-section', [
                    h('label.cp-kanban-section-label', [
                        h('i.fa.fa-check-square'),
                        ' Tasks'
                    ]),
                    tasksContainer = h('div#cp-kanban-edit-tasks')
                ]),

                h('div.cp-kanban-description-section', [
                    h('div.cp-kanban-description-header', [
                        h('label.cp-kanban-section-label', { for: 'cp-kanban-edit-body' }, [
                            h('i.fa.fa-align-left'),
                            ' Description'
                        ]),
                        markdownEditorWrapper
                    ]),
                    h('div#cp-kanban-edit-body', [
                        text = h('textarea')
                    ])
                ])
            ]),

            // ===== GROUP 2: Metadata (Assignees + Schedule side by side) =====
            h('div.cp-kanban-modal-group.cp-kanban-group-metadata', [
                h('div.cp-kanban-metadata-row', [
                    // Assignees column
                    h('div.cp-kanban-assignee-column', [
                        h('label.cp-kanban-section-label', { for: 'cp-kanban-edit-assignee' }, [
                            h('i.fa.fa-user'),
                            ' Assignees'
                        ]),
                        assigneeInput = h('div#cp-kanban-edit-assignee.cp-kanban-assignee-checkboxes')
                    ]),
                    // Schedule column
                    h('div.cp-kanban-schedule-column', [
                        h('label.cp-kanban-section-label', [
                            h('i.fa.fa-calendar'),
                            ' Schedule'
                        ]),
                        h('div.cp-kanban-dates-row', [
                            h('div.cp-kanban-date-field', [
                                h('label.cp-kanban-date-label', { for: 'cp-kanban-edit-start-date' }, 'Start'),
                                startDateInput = h('input#cp-kanban-edit-start-date', { type: 'date' })
                            ]),
                            h('div.cp-kanban-date-field', [
                                h('label.cp-kanban-date-label', { for: 'cp-kanban-edit-due-date' }, 'Due'),
                                dueDateInput = h('input#cp-kanban-edit-due-date', { type: 'date' })
                            ])
                        ])
                    ])
                ])
            ]),

            // Hidden tags/colors containers (keep data but don't show UI)
            tagsDiv = h('div#cp-kanban-edit-tags', { style: 'display: none;' }),
            h('div', { style: 'display: none;' }, [colors]),

            // ===== GROUP 4: Advanced =====
            h('div.cp-kanban-modal-group.cp-kanban-group-advanced', [
                h('div.cp-kanban-status-toggles', [
                    h('div.cp-kanban-completed-section', [
                        completedToggle = h('label.cp-kanban-completed-toggle-label', {
                            title: 'Mark this project as complete'
                        }, [
                            h('input#cp-kanban-edit-completed', { type: 'checkbox' }),
                            h('i.fa.fa-check-circle'),
                            h('span', 'Mark as Complete')
                        ])
                    ]),
                ]),
                h('div.cp-kanban-scoring-section', scoringElements)
            ]),

            // Auto-save indicator - shows briefly after changes
            h('div.cp-kanban-autosave-indicator', [
                h('i.fa.fa-check'),
                h('span', 'Saved')
            ])
        ]);
        var $tags = $(tagsDiv);

        var $conflict = $(conflicts);
        var $cc = $(conflictContainer);
        var conflict = {
            setValue: function () {
                $conflict.empty();
                var i = 0;
                $cc.hide();
                Object.keys(remoteCursors).forEach(function (nid) {
                    var c = remoteCursors[nid];
                    var avatar = getAvatar(c, true);
                    if (Number(c.item) === Number(id) || Number(c.board) === Number(id)) {
                        $conflict.append(avatar);
                        i++;
                    }
                });
                if (!i) { return; }
                $cc.show();
            }
        };

        // Title
        var $title = $(titleInput);
        $title.on('change keyup', function () {
            dataObject.title = $title.val();
            commit();
        });
        var title = {
            getValue: function () {
                return $title.val();
            },
            setValue: function (val, preserveCursor) {
                if (!preserveCursor) {
                    $title.val(val);
                } else {
                    setValueAndCursor(titleInput, val);
                }
            }
        };

        // Body
        var cm = SFCodeMirror.create("gfm", CodeMirror, text);
        var editor = cm.editor;
        window.easyTest = function () {
            var test = TypingTest.testCode(editor);
            return test;
        };
        editor.setOption('gutters', []);
        editor.setOption('lineNumbers', false);
        editor.setOption('readOnly', false);
        editor.on('keydown', function (editor, e) {
            if (e.which === 27) {
                // Focus the next form element but don't close the modal (stopPropagation)
                $tags.find('.token-input').focus();
            }
            e.stopPropagation();
        });
        var common = framework._.sfCommon;
        var markdownTb = common.createMarkdownToolbar(editor, {
            embed: function (mt) {
                editor.focus();
                editor.replaceSelection($(mt)[0].outerHTML);
            },
            toggleBar: true
        });
        $(markdownEditorWrapper).append(markdownTb.toggleButton);
        $(markdownTb.toolbar).on('keydown', function (e) {
            if (e.which === 27) { // Escape key
                e.preventDefault();
                e.stopPropagation();
                editor.focus(); // Focus the editor instead of closing the modal
            }
            else if (e.which === 13 || e.which === 9) { // "Enter" or "Tab" key should not close modal
                e.stopPropagation();
            }
        });
        $(text).before(markdownTb.toolbar);
        editor.refresh();
        var body = {
            getValue: function () {
                return editor.getValue();
            },
            setValue: function (val, preserveCursor) {
                if (isBoard) { return; }
                if (!preserveCursor) {
                    editor.setValue(val || '');
                    editor.save();
                } else {
                    SFCodeMirror.setValueAndCursor(editor, editor.getValue(), val || '');
                }
            },
            refresh: function () {
                editor.refresh();
            }
        };
        cm.configureTheme(common, function () {});
        SFCodeMirror.mkIndentSettings(editor, framework._.cpNfInner.metadataMgr);
        editor.on('change', function () {
            var val = editor.getValue();
            if (dataObject.body === val) { return; }
            dataObject.body = val;
            commit();
        });

        setTimeout(function () {
            var privateData = framework._.cpNfInner.metadataMgr.getPrivateData();
            var fmConfig = {
                dropArea: $('.CodeMirror'),
                body: $('body'),
                onUploaded: function (ev, data) {
                    var parsed = Hash.parsePadUrl(data.url);
                    var secret = Hash.getSecrets('file', parsed.hash, data.password);
                    var fileHost = privateData.fileHost || privateData.origin;
                    var src = fileHost + Hash.getBlobPathFromHex(secret.channel);
                    var key = Hash.encodeBase64(secret.keys.cryptKey);
                    var mt = UI.mediaTag(src, key).outerHTML;
                    editor.replaceSelection(mt);
                }
            };
            common.createFileManager(fmConfig);
        });


        // Tags
        var _field, initialTags;
        var tags = {
            getValue: function () {
                if (!_field) { return; }
                return _field.getTokens();
            },
            setValue: function (tags, preserveCursor) {
                if (isBoard) { return; }
                if (preserveCursor && initialTags && Sortify(tags || []) === initialTags) {
                    // Don't redraw if there is no change
                    return;
                }
                initialTags = Sortify(tags || []);
                $tags.empty();
                var input = UI.dialog.textInput();
                $tags.append(input);
                var existing = getExistingTags(kanban.options.boards);
                _field = UI.tokenField(input, existing).preventDuplicates(function (val) {
                    UI.warn(Messages._getKey('tags_duplicate', [val]));
                });
                _field.setTokens(tags || []);

                $tags.find('.token-input').off('keydown').on('keydown', function (e) {
                    // if the tokenfield is blank and the user hits enter or escape
                    // then allow the event to propogate (closing the modal)
                    // this can leave behind the autocomplete menu, so forcefully hide it
                    if (!$(this).val() && [13, 27].indexOf(e.which) !== -1) {
                        return void $('.ui-autocomplete.ui-front').hide();
                    }
                    e.stopPropagation();
                });

                var commitTags = function () {
                    if (offline) { return; }
                    setTimeout(function () {
                        dataObject.tags = Util.deduplicateString(_field.getTokens().map(function (t) {
                            return t.toLowerCase();
                        }));
                        initialTags = Sortify(dataObject.tags);
                        commit();
                    });
                };
                _field.tokenfield.on('tokenfield:createdtoken', commitTags);
                _field.tokenfield.on('tokenfield:editedtoken', commitTags);
                _field.tokenfield.on('tokenfield:removedtoken', commitTags);
            }
        };

        // Colors
        var $colors = $(colors);
        var resetThemeClass = function () {
            $colors.find('.cp-palette-color').each(function (i, el) {
                var $c = $(el);
                $c.removeClass('cp-kanban-palette-card');
                $c.removeClass('cp-kanban-palette-board');
                if (isBoard) {
                    $c.addClass('cp-kanban-palette-board');
                } else {
                    $c.addClass('cp-kanban-palette-card');
                }
            });
        };
        var color = {
            getValue: function () {
                return colors.getValue();
            },
            setValue: function (color, preserveCursor) {
                // If preserveCursor is true, skip re-render if data hasn't changed
                if (preserveCursor) {
                    var currentColor = dataObject.color;
                    if (currentColor === color) {
                        return;
                    }
                }

                resetThemeClass();
                colors.setValue(color);
            }
        };

        // Assignee - Multi-select checkboxes
        var $assigneeContainer = $(assigneeInput);

        var renderAssigneeCheckboxes = function (selectedAssignees) {
            $assigneeContainer.empty();
            selectedAssignees = selectedAssignees || [];

            // Parse comma-separated string to array
            if (typeof selectedAssignees === 'string') {
                selectedAssignees = selectedAssignees.split(',').map(function(a) { return a.trim(); }).filter(function(a) { return a; });
            }

            // Get available assignees using the same function as tasks
            var availableAssignees = getAvailableAssignees();

            // Also include any currently selected assignees that might not be in the list
            selectedAssignees.forEach(function(name) {
                if (name && availableAssignees.indexOf(name) === -1) {
                    availableAssignees.push(name);
                }
            });
            availableAssignees.sort();

            if (availableAssignees.length === 0) {
                $assigneeContainer.append(h('em', { style: 'color: #888; font-size: 12px;' }, 'No contacts available'));
                return;
            }

            availableAssignees.forEach(function(name) {
                var isChecked = selectedAssignees.some(function(s) {
                    return s.toLowerCase() === name.toLowerCase();
                });

                var checkbox = h('input.cp-kanban-assignee-checkbox', {
                    type: 'checkbox',
                    value: name
                });
                checkbox.checked = isChecked;

                var label = h('label.cp-kanban-assignee-label', [
                    checkbox,
                    h('span', name)
                ]);

                $(checkbox).off('change').on('change', function() {
                    // Get all checked assignees
                    var checkedAssignees = [];
                    $assigneeContainer.find('.cp-kanban-assignee-checkbox:checked').each(function() {
                        checkedAssignees.push($(this).val());
                    });
                    dataObject.assignee = checkedAssignees.join(', ');
                    commit();
                });

                $assigneeContainer.append(label);
            });
        };

        var assignee = {
            getValue: function () {
                var checkedAssignees = [];
                $assigneeContainer.find('.cp-kanban-assignee-checkbox:checked').each(function() {
                    checkedAssignees.push($(this).val());
                });
                return checkedAssignees.join(', ');
            },
            setValue: function (val, preserveCursor) {
                if (isBoard) { return; }

                // If preserveCursor is true, skip re-render if data hasn't changed
                if (preserveCursor) {
                    var currentVal = dataObject.assignee || '';
                    if (currentVal === (val || '')) {
                        return;
                    }
                }

                renderAssigneeCheckboxes(val || '');
            }
        };

        // Start Date
        var $startDate = $(startDateInput);
        $startDate.on('change', function () {
            dataObject.start_date = $startDate.val();
            commit();
        });
        var start_date = {
            getValue: function () {
                return $startDate.val();
            },
            setValue: function (val, preserveCursor) {
                if (isBoard) { return; }
                if (preserveCursor) {
                    var currentValue = $startDate.val();
                    if (currentValue === (val || '')) {
                        return;
                    }
                }
                $startDate.val(val || '');
            }
        };

        // Due Date
        var $dueDate = $(dueDateInput);
        $dueDate.on('change', function () {
            dataObject.due_date = $dueDate.val();
            commit();
        });
        var due_date = {
            getValue: function () {
                return $dueDate.val();
            },
            setValue: function (val, preserveCursor) {
                if (isBoard) { return; }
                if (preserveCursor) {
                    var currentValue = $dueDate.val();
                    if (currentValue === (val || '')) {
                        return;
                    }
                }
                $dueDate.val(val || '');
            }
        };

        // Completed Toggle
        var $completedCheckbox = $(completedToggle).find('input[type="checkbox"]');
        var $completedSection = $(completedToggle).closest('.cp-kanban-completed-section');
        $completedCheckbox.on('change', function () {
            dataObject.completed = $completedCheckbox.prop('checked');
            commit();
        });
        var completed = {
            getValue: function () {
                return $completedCheckbox.prop('checked');
            },
            setValue: function (val) {
                if (isBoard) {
                    $completedSection.hide();
                    return;
                }
                $completedSection.show();
                $completedCheckbox.prop('checked', !!val);
            }
        };

        // Scoring Sliders - Store in CryptPad's native data structure
        var scoringData = {};

        // Update composite score display with progress bar
        var updateCompositeScore = function() {
            var total = 0;
            var count = 0;
            Object.keys(scoringSliders).forEach(function(key) {
                var val = scoringData[key] || 0;
                if (val > 0) {
                    total += val;
                    count++;
                }
            });
            var composite = count > 0 ? Math.round((total / count) * 10) / 10 : 0;
            $(compositeScoreDisplay).text(composite + '/10');

            // Update progress bar width and color
            var percentage = (composite / 10) * 100;
            $(scoreProgressBar).css('width', percentage + '%');

            // Color based on score: red (0-3), orange (4-5), yellow (6-7), green (8-10)
            var barColor;
            if (composite <= 3) {
                barColor = '#e74c3c'; // red
            } else if (composite <= 5) {
                barColor = '#e67e22'; // orange
            } else if (composite <= 7) {
                barColor = '#f1c40f'; // yellow
            } else {
                barColor = '#27ae60'; // green
            }
            $(scoreProgressBar).css('background-color', barColor);
        };

        Object.keys(scoringSliders).forEach(function(key) {
            var sliderObj = scoringSliders[key];
            var $slider = $(sliderObj.slider);
            var $display = $(sliderObj.display);

            $slider.on('input change', function() {
                var value = parseInt($slider.val());
                // Validate input range (0-10)
                if (isNaN(value) || value < 0 || value > 10) {
                    value = 0; // Default to safe value
                    $slider.val(value); // Update slider to safe value
                }
                $display.text(value);
                scoringData[key] = value;

                // Update composite score
                updateCompositeScore();

                // Save to CryptPad's native data structure
                dataObject.scoring = dataObject.scoring || {};
                dataObject.scoring[key] = value;
                commit(); // This saves to CryptPad like assignee and due_date
            });
        });
        
        // Scoring field handler
        var scoring = {
            getValue: function() {
                return dataObject.scoring || {};
            },
            setValue: function(scoringObj, preserveCursor) {
                if (isBoard) { return; }
                scoringObj = scoringObj || {};

                // If preserveCursor is true, skip re-render if data hasn't changed
                if (preserveCursor) {
                    var currentScoring = dataObject.scoring || {};
                    if (JSON.stringify(currentScoring) === JSON.stringify(scoringObj)) {
                        return;
                    }
                }

                dataObject.scoring = scoringObj;

                // Update all sliders with saved values
                Object.keys(scoringSliders).forEach(function(key) {
                    var value = scoringObj[key] || 0;
                    // Validate loaded values (defense in depth)
                    if (isNaN(value) || value < 0 || value > 10) {
                        value = 0; // Default to safe value
                    }
                    var sliderObj = scoringSliders[key];
                    $(sliderObj.slider).val(value);
                    $(sliderObj.display).text(value);
                    scoringData[key] = value;
                });

                // Update composite score display
                updateCompositeScore();
            }
        };

        // Tasks field handler
        var $tasksContainer = $(tasksContainer);
        var isLocalTaskChange = false; // Flag to prevent re-render during local changes

        // Helper to get all available assignees (current user + friends/contacts + online users + historical assignees)
        var getAvailableAssignees = function () {
            var assignees = [];
            var seenNames = {};

            var metadataMgr = framework._.cpNfInner.metadataMgr;
            var priv = metadataMgr.getPrivateData();

            // 0. Always add current user first
            var currentUserData = metadataMgr.getUserData();
            var currentUserName = currentUserData.name || '';
            if (currentUserName && !seenNames[currentUserName.toLowerCase()]) {
                seenNames[currentUserName.toLowerCase()] = true;
                assignees.push(currentUserName);
            }

            // 1. Add all friends/contacts (these are users who could have access)
            var friends = priv.friends || {};
            Object.keys(friends).forEach(function(curve) {
                if (curve === 'me') { return; } // Skip self entry
                var friend = friends[curve] || {};
                var name = friend.displayName || '';
                if (name && !seenNames[name.toLowerCase()]) {
                    seenNames[name.toLowerCase()] = true;
                    assignees.push(name);
                }
            });

            // 2. Add online users from metadata (in case they're not in friends list)
            var userData = metadataMgr.getMetadata().users || {};
            var uids = [];
            Object.keys(userData).forEach(function(netfluxId) {
                var data = userData[netfluxId] || {};
                var userId = data.uid;
                if (!userId) { return; }
                if (netfluxId !== data.netfluxId) { return; }
                if (uids.indexOf(userId) === -1) {
                    uids.push(userId);
                    var name = data.name || '';
                    if (name && !seenNames[name.toLowerCase()]) {
                        seenNames[name.toLowerCase()] = true;
                        assignees.push(name);
                    }
                }
            });

            // 3. Add any existing assignees from tasks (historical names)
            var boards = kanban.options.boards || {};
            var items = boards.items || {};
            Object.keys(items).forEach(function(itemId) {
                var item = items[itemId];
                if (Array.isArray(item.tasks)) {
                    item.tasks.forEach(function(task) {
                        var assignee = (task.assignee || '').trim();
                        if (assignee && !seenNames[assignee.toLowerCase()]) {
                            seenNames[assignee.toLowerCase()] = true;
                            assignees.push(assignee);
                        }
                    });
                }
            });

            return assignees.sort();
        };

        var renderTasksList = function (tasksArray) {
            // Skip re-render if this is a local change
            if (isLocalTaskChange) {
                return;
            }

            tasksArray = tasksArray || [];

            // Preserve scroll position
            var scrollTop = $tasksContainer.scrollTop();

            // Clear existing tasks
            $tasksContainer.empty();

            // Get available assignees for the dropdown
            var availableAssignees = getAvailableAssignees();

            tasksArray.forEach(function (task, index) {
                var checkbox = h('input.cp-kanban-task-checkbox', {
                    type: 'checkbox'
                });
                // Set checked property directly (not as attribute)
                checkbox.checked = !!task.done;
                var titleInput = h('input.cp-kanban-task-title', {
                    type: 'text',
                    value: task.title || '',
                    placeholder: 'Task title'
                });

                // Create assignee dropdown select
                var taskAssignee = (task.assignee || '').trim();
                var isUnassigned = !taskAssignee;
                var assigneeOptions = [h('option', { value: '', selected: isUnassigned }, '-- Unassigned --')];
                var foundCurrentAssignee = false;

                availableAssignees.forEach(function(name) {
                    var isSelected = !isUnassigned && name.toLowerCase() === taskAssignee.toLowerCase();
                    if (isSelected) foundCurrentAssignee = true;
                    assigneeOptions.push(h('option', {
                        value: name,
                        selected: isSelected
                    }, name));
                });

                // If current assignee isn't in the list, add it
                if (taskAssignee && !foundCurrentAssignee) {
                    assigneeOptions.push(h('option', {
                        value: taskAssignee,
                        selected: true
                    }, taskAssignee));
                }

                var assigneeSelect = h('select.cp-kanban-task-assignee', assigneeOptions);

                // Due date input
                var dueDateInput = h('input.cp-kanban-task-due-date', {
                    type: 'date',
                    value: task.due_date || '',
                    title: 'Task due date'
                });

                var deleteBtn = h('button.cp-kanban-task-delete.btn.btn-danger', {
                    title: 'Delete this task'
                }, [
                    h('i.fa.fa-trash')
                ]);

                var taskRowClass = 'cp-kanban-task-row' + (task.done ? ' cp-kanban-task-done' : '');
                var taskRow = h('div.' + taskRowClass.replace(/\s+/g, '.'), { 'data-task-index': index }, [
                    checkbox,
                    titleInput,
                    assigneeSelect,
                    dueDateInput,
                    deleteBtn
                ]);

                // Event handlers
                $(checkbox).off('change').on('change', function () {
                    var currentTasks = (dataObject.tasks || []).slice();
                    if (currentTasks[index]) {
                        currentTasks[index] = Object.assign({}, currentTasks[index], { done: this.checked });
                        dataObject.tasks = currentTasks;

                        // Set flag to prevent re-render during local change
                        isLocalTaskChange = true;
                        commit();

                        // Reset flag after a short delay to allow remote changes
                        setTimeout(function() {
                            isLocalTaskChange = false;
                        }, 100);

                        // Update visual state
                        $(taskRow).toggleClass('cp-kanban-task-done', this.checked);
                    }
                });

                $(titleInput).off('change keyup').on('change keyup', function () {
                    var currentTasks = (dataObject.tasks || []).slice();
                    if (currentTasks[index]) {
                        currentTasks[index] = Object.assign({}, currentTasks[index], { title: $(this).val() });
                        dataObject.tasks = currentTasks;
                        commit();
                    }
                });

                $(assigneeSelect).off('change').on('change', function () {
                    var selectedValue = $(this).val();
                    var currentTasks = (dataObject.tasks || []).slice();
                    if (currentTasks[index]) {
                        currentTasks[index] = Object.assign({}, currentTasks[index], { assignee: selectedValue });
                        dataObject.tasks = currentTasks;
                        commit();
                    }
                });

                $(dueDateInput).off('change').on('change', function () {
                    var currentTasks = (dataObject.tasks || []).slice();
                    if (currentTasks[index]) {
                        currentTasks[index] = Object.assign({}, currentTasks[index], { due_date: $(this).val() });
                        dataObject.tasks = currentTasks;
                        commit();
                    }
                });

                $(deleteBtn).off('click').on('click', function () {
                    var currentTasks = (dataObject.tasks || []).slice();
                    currentTasks.splice(index, 1);
                    dataObject.tasks = currentTasks;
                    commit();
                    renderTasksList(dataObject.tasks);
                });

                // Apply done styling
                if (task.done) {
                    $(taskRow).addClass('cp-kanban-task-done');
                }

                $tasksContainer.append(taskRow);
            });

            // Add task button
            var addTaskBtn = h('button.cp-kanban-task-add', {
                title: 'Add a new task to this project'
            }, [
                h('i.fa.fa-plus'),
                ' Add task'
            ]);

            $(addTaskBtn).off('click').on('click', function () {
                var currentTasks = (dataObject.tasks || []).slice();
                var metadataMgr = framework._.cpNfInner.metadataMgr;
                var currentUserName = metadataMgr.getUserData().name || '';
                // Store createdBy as lowercase for consistent comparison
                var newTask = createTask('', currentUserName, currentUserName.toLowerCase());
                currentTasks.push(newTask);
                dataObject.tasks = currentTasks;
                commit();
                renderTasksList(dataObject.tasks);
                // Focus the new task title input
                $tasksContainer.find('.cp-kanban-task-row:last-child .cp-kanban-task-title').focus();
            });

            $tasksContainer.append(addTaskBtn);

            // Restore scroll position
            $tasksContainer.scrollTop(scrollTop);
        };

        var tasks = {
            getValue: function () {
                return dataObject.tasks || [];
            },
            setValue: function (tasksArray, preserveCursor) {
                if (isBoard) { return; }
                tasksArray = tasksArray || [];
                // Ensure tasks is always an array
                if (!Array.isArray(tasksArray)) { tasksArray = []; }

                // If preserveCursor is true, skip re-render if data hasn't changed
                // This prevents losing focus/selection when user is editing
                if (preserveCursor) {
                    var currentTasks = dataObject.tasks || [];
                    if (JSON.stringify(currentTasks) === JSON.stringify(tasksArray)) {
                        return;
                    }
                }

                dataObject.tasks = tasksArray;
                renderTasksList(tasksArray);
            }
        };

        var button = [{
            className: 'danger left',
            name: Messages.kanban_delete,
            confirm: true,
            onClick: function (/*button*/) {
                var boards = kanban.options.boards || {};
                if (isBoard) {
                    var list = boards.list || [];
                    var idx = list.indexOf(id);
                    if (idx !== -1) { list.splice(idx, 1); }
                    delete (boards.data || {})[id];
                    kanban.removeBoard(id);
                    return void commit();
                }
                Object.keys(boards.data || {}).forEach(function (boardId) {
                    var board = boards.data[boardId];
                    if (!board) { return; }
                    var items = board.item || [];
                    var idx = items.indexOf(id);
                    if (idx !== -1) { items.splice(idx, 1); }
                });
                delete (boards.items || {})[id];
                commit();
            },
            keys: []
        }, {
            className: 'primary',
            name: Messages.filePicker_close,
            onClick: function () {
                onCursorUpdate.fire({});
            },
            keys: [13, 27]
        }];
        var modal = UI.dialog.customModal(content, {
            buttons: button
        });
        modal.classList.add('cp-kanban-edit-modal');
        var $modal = $(modal);

        framework.onEditableChange(function (unlocked) {
            editor.setOption('readOnly', !unlocked);
            $title.prop('disabled', unlocked ? '' : 'disabled');
            if (_field) {
                $(_field.element).tokenfield(unlocked ? 'enable' : 'disable');
            }

            $modal.find('nav button.danger').prop('disabled', unlocked ? '' : 'disabled');
            offline = !unlocked;
            colors.disable(offline);
        });


        var setId = function (_isBoard, _id) {
            // Reset the mdoal with a new id
            isBoard = _isBoard;
            id = Number(_id);
            if (_isBoard) {
                onCursorUpdate.fire({
                    board: _id
                });
                dataObject = kanban.getBoardJSON(id);
                $(content)
                    .find('#cp-kanban-edit-body, #cp-kanban-edit-tags, [for="cp-kanban-edit-body"], [for="cp-kanban-edit-tags"]')
                    .hide();
            } else {
                onCursorUpdate.fire({
                    item: _id
                });
                dataObject = kanban.getItemJSON(id);
                $(content)
                    .find('#cp-kanban-edit-body, #cp-kanban-edit-tags, [for="cp-kanban-edit-body"], [for="cp-kanban-edit-tags"]')
                    .show();
            }
            // Also reset the buttons
            $modal.find('nav').after(UI.dialog.getButtons(button)).remove();
        };

        onRemoteChange.reg(function () {
            if (isBoard) {
                dataObject = kanban.getBoardJSON(id);
            } else {
                dataObject = kanban.getItemJSON(id);
            }
            // Check if our item has been deleted
            if (!dataObject) {
                var $frame = $(modal).parents('.alertify').first();
                if ($frame[0] && $frame[0].closeModal) {
                    $frame[0].closeModal();
                }
                return;
            }
            // Not deleted, apply updates
            editModal.conflict.setValue();
            PROPERTIES.forEach(function (type) {
                // Only update properties that have a setValue method in editModal
                if (editModal[type] && typeof editModal[type].setValue === 'function') {
                    editModal[type].setValue(dataObject[type], true);
                }
            });
        });

        return {
            modal: modal,
            setId: setId,
            title: title,
            body: body,
            tags: tags,
            color: color,
            assignee: assignee,
            start_date: start_date,
            due_date: due_date,
            completed: completed,
            scoring: scoring,
            tasks: tasks,
            conflict: conflict
        };
    };
    var getItemEditModal = function (framework, kanban, eid) {
        // Create modal if needed
        if (!editModal) { editModal = createEditModal(framework, kanban); }
        editModal.setId(false, eid);
        var boards = kanban.options.boards || {};
        var item = (boards.items || {})[eid];
        if (!item) { return void UI.warn(Messages.error); }
        editModal.conflict.setValue();
        PROPERTIES.forEach(function (type) {
            if (!editModal[type]) { return; }
            editModal[type].setValue(item[type]);
        });
        
        // Scoring data is now loaded automatically via PROPERTIES system - no external API needed!
        
        UI.openCustomModal(editModal.modal, {wide: true});
        editModal.body.refresh();
    };
    var getBoardEditModal = function (framework, kanban, id) {
        // Create modal if needed
        if (!editModal) { editModal = createEditModal(framework, kanban); }

        editModal.setId(true, id);
        var boards = kanban.options.boards || {};
        var board = (boards.data || {})[id];
        if (!board) { return void UI.warn(Messages.error); }
        editModal.conflict.setValue();
        BOARD_PROPERTIES.forEach(function (type) {
            if (!editModal[type]) { return; }
            editModal[type].setValue(board[type]);
        });
        UI.openCustomModal(editModal.modal, {wide: true});
    };

    addMoveElementButton = function (framework, kanban) {
        if (!kanban) { return; }
        if (framework.isReadOnly() || framework.isLocked()) { return; }
        var $container = $(kanban.element);
        var drag = kanban.drag;
        kanban.options.dragBoards = drag;
        kanban.options.dragItems = drag;
        $container.find('.kanban-board').each(function (i, el) {
            $(el).find('.item-icon-container').remove();
            $(el).find('.kanban-board-header').removeClass('no-drag');
        });
        $container.find('.kanban-item').each(function (i, el) {
            $(el).find('.item-arrow-container').remove();
            $(el).removeClass('no-drag');
        });
        if (drag === false) {
            var move = function (arr, oldIndex, newIndex) {
                arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
                _updateBoards(framework, kanban, kanban.options.boards, false);
            };

            var moveBetweenBoards = function (nextBoardItems, elId, boardItems, index, boards) {
                nextBoardItems.unshift(elId);
                boardItems.splice(index, 1);
                _updateBoards(framework, kanban, boards, false);
                var element = $(`.kanban-item[data-eid="${elId}"]`)[0];
                if (element) {
                    element.scrollIntoView();
                }
            };

            var shiftItem = function (direction, el) {
                var board = $(el).closest('.kanban-board');
                var boards = kanban.options.boards;
                var elId = parseInt($(el).attr("data-eid"));
                var boardId = parseInt($(board).attr("data-id"));
                var boardItems = boards.data[boardId].item;
                var index = boardItems.indexOf(elId);
                var boardIndex = boards.list.indexOf(parseInt(boardId));
                let nextBoardItems;

                if (direction === 'up' && index > 0) {
                    move(boardItems, index, index-1);
                } else if (direction === 'down' && index < boardItems.length-1) {
                    move(boardItems, index, index+1);
                } else if (direction === 'left' && boardIndex > 0) {
                    nextBoardItems = boards.data[boards.list[boardIndex-1]].item;
                    moveBetweenBoards(nextBoardItems, elId, boardItems, index, boards, boardId);
                } else if (direction === 'right' && boardIndex < kanban.options.boards.list.length-1){
                    nextBoardItems = boards.data[boards.list[boardIndex+1]].item;
                    moveBetweenBoards(nextBoardItems, elId, boardItems, index, boards, boardId);
                }
            };

            var shiftBoards = function (direction, el) {
                var elId = $(el).attr("data-id");
                var index = kanban.options.boards.list.indexOf(parseInt(elId));
                if (direction === 'left' && index > 0) {
                    move(kanban.options.boards.list, index, index-1);
                } else if (direction === 'right' && index < kanban.options.boards.list.length-1) {
                    move(kanban.options.boards.list, index, index+1);
                }
                var element = $(`.kanban-board[data-id="${elId}"]`)[0];
                if (element) {
                    element.scrollIntoView();
                }
            };
            $container.find('.kanban-board').each(function (i, el) {
                $(el).find('.kanban-board-header').addClass('no-drag');
                var arrowContainer = h('div.item-icon-container');
                $(arrowContainer).appendTo($(el).find('.kanban-board-header'));
                $(h('button', {
                    'class': 'cp-kanban-arrow board-arrow',
                    'title': Messages.kanban_moveBoardLeft,
                    'aria-label': Messages.kanban_moveBoardLeft
                }, [
                    h('i.fa.fa-arrow-left', {'aria-hidden': true})
                ])).click(function () { 
                    shiftBoards('left', el);
                }).appendTo(arrowContainer);
                $(h('button', {
                    'class': 'cp-kanban-arrow board-arrow',
                    'title': Messages.kanban_moveBoardRight,
                    'aria-label': Messages.kanban_moveBoardRight
                }, [
                    h('i.fa.fa-arrow-right', {'aria-hidden': true})
                ])).click(function () {
                    shiftBoards('right', el);
                }).appendTo(arrowContainer);
            });
            $container.find('.kanban-item').each(function (i, el) {
                $(el).addClass('no-drag');
                var arrowContainerItem = h('div.item-arrow-container');
                $(arrowContainerItem).appendTo((el));
                $(h('button', {
                    'data-notippy':1,
                    'class': 'cp-kanban-arrow item-arrow',
                    'title': Messages.moveItemLeft,
                    'aria-label': Messages.moveItemLeft
                }, [
                    h('i.fa.fa-arrow-left', {'aria-hidden': true})
                ])).click(function () {
                    shiftItem('left', el);
                }).appendTo(arrowContainerItem);
                var centralArrowContainerItem = h('div.item-central-arrow-container');
                $(centralArrowContainerItem).appendTo(arrowContainerItem);
                $(h('button', {
                    'data-notippy':1,
                    'class': 'cp-kanban-arrow item-arrow',
                    'title': Messages.moveItemDown,
                    'aria-label': Messages.moveItemDown
                }, [
                    h('i.fa.fa-arrow-down', {'aria-hidden': true})
                ])).click(function () {
                    shiftItem('down', el);
                }).appendTo(centralArrowContainerItem);
                $(h('button', {
                    'data-notippy':1,
                    'class': 'cp-kanban-arrow item-arrow',
                    'title': Messages.moveItemUp,
                    'aria-label': Messages.moveItemUp
                }, [
                    h('i.fa.fa-arrow-up', {'aria-hidden': true})
                ])).click(function () {
                    shiftItem('up', el);
                }).appendTo(centralArrowContainerItem);
                $(h('button', {
                    'data-notippy':1,
                    'class': 'cp-kanban-arrow item-arrow',
                    'title': Messages.moveItemRight,
                    'aria-label': Messages.moveItemRight
                }, [
                    h('i.fa.fa-arrow-right', {'aria-hidden': true})
                ])).click(function () {
                    shiftItem('right', el);
                }).appendTo(arrowContainerItem);
            });
        } 
    };

    addEditItemButton = function (framework, kanban) {
        if (!kanban) { return; }
        if (framework.isReadOnly() || framework.isLocked()) { return; }
        var $container = $(kanban.element);
        $container.find('.kanban-edit-item').remove();
        $container.find('.kanban-item').each(function (i, el) {
            var itemId = $(el).attr('data-eid');
            $(h('button', {
                'class': 'kanban-edit-item',
                'title': Messages.kanban_editCard,
                'aria-label': Messages.kanban_editCard
            }, [
                h('i.fa.fa-pencil', {'aria-hidden': true})
            ])).click(function (e) {
                getItemEditModal(framework, kanban, itemId);
                e.stopPropagation();
            }).insertAfter($(el).find('.kanban-item-text'));
        });
        $container.find('.kanban-board').each(function (i, el) {
            var itemId = $(el).attr('data-id');
            $(h('button', {
                'class': 'kanban-edit-item',
                'title': Messages.kanban_editBoard,
                'aria-label': Messages.kanban_editBoard
            }, [
                h('i.fa.fa-pencil', {'aria-hidden': true})
            ])).click(function (e) {
                getBoardEditModal(framework, kanban, itemId);
                e.stopPropagation();
            }).appendTo($(el).find('.kanban-board-header'));
        });
    };

    // Kanban code
    var getDefaultBoards = function () {
        var items = {};
        for (var i=1; i<=6; i++) {
            items[i] = {
                id: i,
                title: Messages._getKey('kanban_item', [i])
            };
        }
        var defaultBoards = {
            list: [11, 12, 13],
            data: {
                "11": {
                    "id": 11,
                    "title": Messages.kanban_todo,
                    "item": [1, 2]
                },
                "12": {
                    "id": 12,
                    "title": Messages.kanban_working,
                    "item": [],
                },
                "13": {
                    "id": 13,
                    "title": Messages.kanban_done,
                    "item": [],
                }
            },
            items: items
        };
        return defaultBoards;
    };
    var migrate = function (framework, boards) {
        if (!Array.isArray(boards)) { return; }
        console.log("Migration to new format");
        var b = {
            list: [],
            data: {},
            items: {}
        };
        var i = 1;
        boards.forEach(function (board) {
            board.id = i;
            b.list.push(i);
            b.data[i] = board;
            i++;
            if (!Array.isArray(board.item)) { return; }
            board.item = board.item.map(function (item) {
                item.id = i;
                b.items[i] = item;
                return i++; // return current id and incrmeent after
            });
        });
        return b;
    };


    var initKanban = function (framework, boards) {
        var migrated = false;
        if (!boards) {
            verbose("Initializing with default boards content");
            boards = getDefaultBoards();
        } else if (Array.isArray(boards)) {
            boards = migrate(framework, boards);
            migrated = true;
        } else {
            verbose("Initializing with boards content " + boards);
        }

        // Remove any existing elements
        $(".kanban-container-outer").remove();

        var getInput = function () {
            return $('<input>', {
                'type': 'text',
                'id': 'kanban-edit',
                'size': '30'
            }).click(function (e) { e.stopPropagation(); });
        };

        var openLink = function (href) {
            if (/^\/[^\/]/.test(href)) {
                var privateData = framework._.cpNfInner.metadataMgr.getPrivateData();
                href = privateData.origin + href;
            }
            framework._.sfCommon.openUnsafeURL(href);
        };

        var md = framework._.cpNfInner.metadataMgr.getPrivateData();
        var _tagsAnd = Util.find(md, ['settings', 'kanban', 'tagsAnd']);

        var kanban = new jKanban({
            element: '#cp-app-kanban-content',
            gutter: '5px',
            widthBoard: '300px',
            buttonContent: '❌',
            readOnly: framework.isReadOnly() || framework.isLocked(),
            tagsAnd: _tagsAnd,
            dragItems: true,
            getCurrentUser: function () {
                var metadataMgr = framework._.cpNfInner.metadataMgr;
                return (metadataMgr.getUserData().name || '').toLowerCase();
            },
            refresh: function () {
                onRedraw.fire();
            },
            onChange: function () {
                verbose("Board object has changed");
                framework.localChange();
                if (kanban) {
                    addEditItemButton(framework, kanban);
                    addMoveElementButton(framework, kanban);
                }
            },
            click: function (el) {
                if (framework.isReadOnly() || framework.isLocked()) { return; }
                if (kanban.inEditMode) {
                    $(el).focus();
                    verbose("An edit is already active");
                    //return;
                }
                var eid = $(el).attr('data-eid');
                kanban.inEditMode = eid;
                setTimeout(function () {
                    // Make sure the click is sent after the "blur" in case we move from a card to another
                    onCursorUpdate.fire({
                        item: eid
                    });
                });
                var name = $(el).text();
                $(el).html('');

                // Add input
                var $input = getInput().val(name).appendTo(el).focus();
                $input[0].select();

                var save = function () {
                    // Store the value
                    var name = $input.val();
                    // Remove the input
                    $(el).text(name);
                    // Save the value for the correct board
                    var item = kanban.getItemJSON(eid);
                    item.title = name;
                    kanban.onChange();
                    // Unlock edit mode unless we're already editing
                    // something else
                    if (kanban.inEditMode === eid) {
                        kanban.inEditMode = false;
                    }
                    onCursorUpdate.fire({});
                };
                $input.blur(save);
                $input.keydown(function (e) {
                    if (e.which === 13) {
                        e.preventDefault();
                        e.stopPropagation();
                        save();
                        if (!$input.val()) { return; }
                        if (!$(el).closest('.kanban-item').is(':last-child')) { return; }
                        $(el).closest('.kanban-board').find('.kanban-title-button').click();
                        return;
                    }
                    if (e.which === 27) {
                        e.preventDefault();
                        e.stopPropagation();
                        save();
                    }
                });
                $input.on('change keyup', function () {
                    var item = kanban.getItemJSON(eid);
                    if (!item) { return; }
                    var name = $input.val();
                    item.title = name;
                    framework.localChange();
                });

            },
            boardTitleClick: function (el, e) {
                e.stopPropagation();
                if (framework.isReadOnly() || framework.isLocked()) { return; }
                if (kanban.inEditMode) {
                    $(el).focus();
                    verbose("An edit is already active");
                    //return;
                }
                var boardId = $(el).closest('.kanban-board').attr("data-id");
                kanban.inEditMode = boardId;
                setTimeout(function () {
                    // Make sure the click is sent after the "blur" in case we move from a card to another
                    onCursorUpdate.fire({
                        board: boardId
                    });
                });

                var name = $(el).text();
                $(el).html('');
                var $input = getInput().val(name).appendTo(el).focus();
                $input[0].select();

                var save = function () {
                    // Store the value
                    var name = $input.val();
                    if (!name || !name.trim()) {
                        return kanban.onChange();
                    }
                    // Remove the input
                    $(el).text(name);
                    // Save the value for the correct board
                    kanban.getBoardJSON(boardId).title = name;
                    kanban.onChange();
                    // Unlock edit mode
                    if (kanban.inEditMode === boardId) {
                        kanban.inEditMode = false;
                    }
                    onCursorUpdate.fire({});
                };
                $input.blur(save);
                $input.keydown(function (e) {
                    if (e.which === 13) {
                        e.preventDefault();
                        e.stopPropagation();
                        save();
                        return;
                    }
                    if (e.which === 27) {
                        e.preventDefault();
                        e.stopPropagation();
                        save();
                        return;
                    }
                });
                $input.on('change keyup', function () {
                    var item = kanban.getBoardJSON(boardId);
                    if (!item) { return; }
                    var name = $input.val();
                    item.title = name;
                    framework.localChange();
                });
            },
            addItemClick: function (el) {
                if (framework.isReadOnly() || framework.isLocked()) { return; }
                var $el = $(el);
                if (kanban.inEditMode) {
                    $el.focus();
                    verbose("An edit is already active");
                    //return;
                }
                kanban.inEditMode = "new";
                // create a form to enter element
                var isTop = $el.attr('data-top');
                var boardId = $el.closest('.kanban-board').attr("data-id");
                var $item = $('<div>', {'class': 'kanban-item new-item'});
                var $text = $('<div>', {'class': 'kanban-item-text'}).appendTo($item);
                if (isTop) {
                    $item.addClass('item-top');
                }
                var $input = getInput().val('').appendTo($text);
                kanban.addForm(boardId, $item[0], isTop);
                $input.focus();
                setTimeout(function () {
                    if (isTop) {
                        $el.closest('.kanban-drag').scrollTop(0);
                    } else {
                        var element = $input[0];
                        if (element) {
                            element.scrollIntoView();
                        }
                    }
                });
                var save = function () {
                    $item.remove();
                    if (kanban.inEditMode === "new") {
                        kanban.inEditMode = false;
                    }
                    onCursorUpdate.fire({});
                    if (!$input.val()) { return; }
                    var id = Util.createRandomInteger();
                    while (kanban.getItemJSON(id)) {
                        id = Util.createRandomInteger();
                    }
                    var metadataMgr = framework._.cpNfInner.metadataMgr;
                    var currentUserName = metadataMgr.getUserData().name || '';
                    var item = {
                        "id": id,
                        "title": $input.val(),
                        "createdBy": currentUserName.toLowerCase()
                    };
                    if (kanban.options.tags && kanban.options.tags.length) {
                        item.tags = kanban.options.tags;
                    }
                    kanban.addElement(boardId, item, isTop);
                    addMoveElementButton(framework, kanban);
                };
                $input.blur(save);
                $input.keydown(function (e) {
                    if (e.which === 13) {
                        e.preventDefault();
                        e.stopPropagation();
                        save();
                        if (!$input.val()) { return; }
                        var $footer = $el.closest('.kanban-board').find('footer');
                        if (isTop) {
                            $footer.find('.kanban-title-button[data-top]').click();
                        } else {
                            $footer.find('.kanban-title-button').click();
                        }
                        return;
                    }
                    if (e.which === 27) {
                        e.preventDefault();
                        e.stopPropagation();
                        $item.remove();
                        kanban.inEditMode = false;
                        onCursorUpdate.fire({});
                        return;
                    }
                });
            },
            applyHtml: function (html, node) {
                DiffMd.apply(html, $(node),framework._.sfCommon);
            },
            renderMd: function (md) {
                return DiffMd.render(md);
            },
            addItemButton: true,
            getTextColor: getTextColor,
            getAvatar: getAvatar,
            openLink: openLink,
            getTags: getExistingTags,
            cursors: remoteCursors,
            boards: boards,
            _boards: Util.clone(boards),
        });

        framework._.cpNfInner.metadataMgr.onChange(function () {
            var md = framework._.cpNfInner.metadataMgr.getPrivateData();
            var tagsAnd = Util.find(md, ['settings', 'kanban', 'tagsAnd']);
            if (_tagsAnd === tagsAnd) { return; }

            // If the rendering has changed, update the value and redraw
            kanban.options.tagsAnd = tagsAnd;
            _tagsAnd = tagsAnd;
            updateBoards(framework, kanban, kanban.options.boards);
        });

        if (migrated) { framework.localChange(); }

        var addBoardDefault = document.getElementById('kanban-addboard');
        let $addBoard = $(addBoardDefault).attr('tabindex', 0);
        $(addBoardDefault).attr('title', Messages.kanban_addBoard);
        Util.onClickEnter($addBoard, function () {
            if (framework.isReadOnly() || framework.isLocked()) { return; }
            /*var counter = 1;

            // Get the new board id
            var boardExists = function (b) { return b.id === "board" + counter; };
            while (kanban.options.boards.some(boardExists)) { counter++; }
            */
            var id = Util.createRandomInteger();
            while (kanban.getBoardJSON(id)) {
                id = Util.createRandomInteger();
            }

            kanban.addBoard({
                "id": id,
                "title": Messages.kanban_newBoard,
                "item": []
            });
            kanban.onChange();
        });

        var $container = $('#cp-app-kanban-content');
        var $cContainer = $('#cp-app-kanban-container');
        var addControls = function () {
            // Compact or full mode - controls card detail visibility including task checklists
            var isCompactMode = false;
            var small = h('button.cp-kanban-view-small.fa.fa-compress', { title: 'Compact view - hide card details' });
            var big = h('button.cp-kanban-view.fa.fa-expand', { title: 'Full view - show card details' });

            var updateCardDetailVisibility = function() {
                if (isCompactMode) {
                    $cContainer.addClass('cp-kanban-quick');
                    $('.kanban-card-tasks').hide();
                    $(small).attr('title', 'Hide card details');
                    $(big).attr('title', 'Show card details');
                } else {
                    $cContainer.removeClass('cp-kanban-quick');
                    $('.kanban-card-tasks').show();
                    $(small).attr('title', 'Hide card details');
                    $(big).attr('title', 'Show card details');
                }
            };

            $(small).click(function () {
                if (isCompactMode) { return; }
                isCompactMode = true;
                updateCardDetailVisibility();
            });
            $(big).click(function () {
                if (!isCompactMode) { return; }
                isCompactMode = false;
                updateCardDetailVisibility();
            });

            // Tags filter
            var existing = getExistingTags(kanban.options.boards);
            var list = h('div.cp-kanban-filterTags-list');
            var reset = h('button.btn.btn-cancel.cp-kanban-filterTags-reset.cp-kanban-toggle-tags', {
                title: 'Clear all tag filters'
            }, [
                h('i.fa.fa-times'),
                h('span', Messages.kanban_clearFilter)
            ]);
            // Create advanced filter controls first
            var getAllAssignees = function() {
                var assignees = [];
                var seenNames = {};

                var metadataMgr = framework._.cpNfInner.metadataMgr;
                var priv = metadataMgr.getPrivateData();

                // 0. Always add current user first
                var currentUserData = metadataMgr.getUserData();
                var currentUserName = currentUserData.name || '';
                if (currentUserName && !seenNames[currentUserName.toLowerCase()]) {
                    seenNames[currentUserName.toLowerCase()] = true;
                    assignees.push(currentUserName);
                }

                // 1. Add all friends/contacts
                var friends = priv.friends || {};
                Object.keys(friends).forEach(function(curve) {
                    if (curve === 'me') { return; }
                    var friend = friends[curve] || {};
                    var name = friend.displayName || '';
                    if (name && !seenNames[name.toLowerCase()]) {
                        seenNames[name.toLowerCase()] = true;
                        assignees.push(name);
                    }
                });

                // 2. Add online users
                var userData = metadataMgr.getMetadata().users || {};
                var uids = [];
                Object.keys(userData).forEach(function(netfluxId) {
                    var data = userData[netfluxId] || {};
                    var userId = data.uid;
                    if (!userId) { return; }
                    if (netfluxId !== data.netfluxId) { return; }
                    if (uids.indexOf(userId) === -1) {
                        uids.push(userId);
                        var name = data.name || '';
                        if (name && !seenNames[name.toLowerCase()]) {
                            seenNames[name.toLowerCase()] = true;
                            assignees.push(name);
                        }
                    }
                });

                // 3. Add existing card assignees (historical)
                Object.keys(kanban.options.boards.items || {}).forEach(function(id) {
                    var item = kanban.options.boards.items[id];
                    // Project/card assignees
                    if (item.assignee) {
                        var itemAssignees = item.assignee.split(',').map(function(a) { return a.trim(); }).filter(function(a) { return a; });
                        itemAssignees.forEach(function(a) {
                            if (a && !seenNames[a.toLowerCase()]) {
                                seenNames[a.toLowerCase()] = true;
                                assignees.push(a);
                            }
                        });
                    }
                    // Task assignees
                    if (Array.isArray(item.tasks)) {
                        item.tasks.forEach(function(task) {
                            if (task.assignee) {
                                var taskAssignees = task.assignee.split(',').map(function(a) { return a.trim(); }).filter(function(a) { return a; });
                                taskAssignees.forEach(function(a) {
                                    if (a && !seenNames[a.toLowerCase()]) {
                                        seenNames[a.toLowerCase()] = true;
                                        assignees.push(a);
                                    }
                                });
                            }
                        });
                    }
                });

                return assignees.sort();
            };

            // Create visibility filter toggle (shared across all views)
            // Hidden functionality removed - was not cryptographically secure
            var visibilityFilterToggle = h('div.cp-kanban-visibility-filter', [
                h('button.cp-kanban-visibility-btn.active', { 'data-visibility': 'all', title: 'Show all items' }, 'All')
            ]);

            // ============================================================
            // FILTER/SORT CONTROLS - Vertical stacked layout
            // Clean design: label on left, control on right
            // ============================================================
            var filterControls = h('div.cp-kanban-filter-controls', [
                // Assignee filter
                h('div.cp-kanban-filter-row.cp-kanban-filter-assignee', [
                    h('label.cp-kanban-filter-label', 'Assignee'),
                    h('select.cp-kanban-filter-assignee-select', [
                        h('option', { value: '' }, 'All')
                    ])
                ]),
                // Status filter
                h('div.cp-kanban-filter-row.cp-kanban-filter-status', [
                    h('label.cp-kanban-filter-label', 'Status'),
                    h('select.cp-kanban-filter-status-select', [
                        h('option', { value: '' }, 'All'),
                        h('option', { value: 'incomplete' }, 'Incomplete'),
                        h('option', { value: 'complete' }, 'Complete')
                    ])
                ]),
                // Due date filter
                h('div.cp-kanban-filter-row.cp-kanban-filter-due', [
                    h('label.cp-kanban-filter-label', 'Due'),
                    h('select.cp-kanban-filter-due-select', [
                        h('option', { value: '' }, 'All'),
                        h('option', { value: 'overdue' }, 'Overdue'),
                        h('option', { value: 'today' }, 'Today'),
                        h('option', { value: 'week' }, 'This week'),
                        h('option', { value: 'month' }, 'This month'),
                        h('option', { value: 'quarter' }, 'This quarter'),
                        h('option', { value: 'none' }, 'No due date')
                    ])
                ]),
                // Score filter - only for Pipeline/Timeline (projects have scores, tasks don't)
                h('div.cp-kanban-filter-row.cp-kanban-filter-score', [
                    h('label.cp-kanban-filter-label', 'Score'),
                    h('div.cp-kanban-score-control', [
                        h('input.cp-kanban-filter-score-min', { type: 'range', min: '0', max: '10', value: '0', step: '0.5' }),
                        h('span.cp-kanban-filter-score-value', '0')
                    ])
                ]),
                // Sort control
                h('div.cp-kanban-filter-row.cp-kanban-filter-sort', [
                    h('label.cp-kanban-filter-label', 'Sort'),
                    h('select.cp-kanban-sort-select', [
                        h('option', { value: '' }, 'Default'),
                        // Project sort options (shown in Pipeline/Timeline)
                        h('optgroup.cp-sort-project-options', { label: 'By Project' }, [
                            h('option', { value: 'project-score-desc' }, 'Score (high to low)'),
                            h('option', { value: 'project-score-asc' }, 'Score (low to high)'),
                            h('option', { value: 'project-due-asc' }, 'Due date (soonest)'),
                            h('option', { value: 'project-due-desc' }, 'Due date (latest)'),
                            h('option', { value: 'project-assignee' }, 'Assignee (A-Z)')
                        ]),
                        // Task sort options (shown in Tasks view)
                        h('optgroup.cp-sort-task-options', { label: 'By Task' }, [
                            h('option', { value: 'task-due-asc' }, 'Due date (soonest)'),
                            h('option', { value: 'task-due-desc' }, 'Due date (latest)'),
                            h('option', { value: 'task-assignee' }, 'Assignee (A-Z)'),
                            h('option', { value: 'task-project' }, 'Parent project')
                        ])
                    ])
                ])
            ]);

            // Advanced filters container (sort is now integrated into filterControls)
            var advancedFilters = h('div.cp-kanban-advanced-filters', [
                filterControls
            ]);

            var currentFilters = {
                assignee: '',
                sort: '',
                minScore: 0,
                duePreset: '',
                visibility: 'all',
                status: ''
            };

            // Get filter elements
            var assigneeSelect = advancedFilters.querySelector('.cp-kanban-filter-assignee-select');
            var statusSelect = advancedFilters.querySelector('.cp-kanban-filter-status-select');
            var sortSelect = advancedFilters.querySelector('.cp-kanban-sort-select');
            var scoreMin = advancedFilters.querySelector('.cp-kanban-filter-score-min');
            var scoreValue = advancedFilters.querySelector('.cp-kanban-filter-score-value');
            var duePresetSelect = advancedFilters.querySelector('.cp-kanban-filter-due-select');

            // jQuery references for show/hide
            var $assigneeFilterDiv = $(advancedFilters).find('.cp-kanban-filter-assignee');
            var $statusFilterDiv = $(advancedFilters).find('.cp-kanban-filter-status');
            var $dueFilterDiv = $(advancedFilters).find('.cp-kanban-filter-due');
            var $scoreFilterDiv = $(advancedFilters).find('.cp-kanban-filter-score');
            var $sortSelect = $(sortSelect);
            var $projectSortOptions = $sortSelect.find('.cp-sort-project-options');
            var $taskSortOptions = $sortSelect.find('.cp-sort-task-options');

            // Update assignee dropdown
            var updateAssigneeDropdown = function() {
                var allAssignees = getAllAssignees();
                var currentValue = assigneeSelect.value;

                // Clear existing options except "All Assignees"
                while (assigneeSelect.children.length > 1) {
                    assigneeSelect.removeChild(assigneeSelect.lastChild);
                }

                // Add assignee options
                allAssignees.forEach(function(assignee) {
                    var option = h('option', { value: assignee }, assignee);
                    assigneeSelect.appendChild(option);
                });

                // Restore selection if still valid (case-insensitive comparison)
                var currentValueLower = (currentValue || '').toLowerCase();
                var matchingAssignee = allAssignees.find(function(a) {
                    return (a || '').toLowerCase() === currentValueLower;
                });
                if (matchingAssignee) {
                    assigneeSelect.value = matchingAssignee;
                }
            };

            // Apply all filters and sorting
            var applyFilters = function() {
                currentFilters.assignee = assigneeSelect.value;
                currentFilters.status = statusSelect.value;
                currentFilters.sort = sortSelect.value;
                currentFilters.minScore = parseFloat(scoreMin.value);
                currentFilters.duePreset = duePresetSelect.value;

                // Apply custom filter
                kanban.options.customFilter = function(item) {
                    // Assignee filter (case-insensitive)
                    if (currentFilters.assignee) {
                        if (!item.assignee) return false;
                        var filterAssigneeLower = currentFilters.assignee.toLowerCase();
                        var itemAssignees = item.assignee.split(',').map(function(a) { return a.trim().toLowerCase(); });
                        if (itemAssignees.indexOf(filterAssigneeLower) === -1) return false;
                    }

                    // Status filter (project completion)
                    if (currentFilters.status === 'incomplete' && item.completed) return false;
                    if (currentFilters.status === 'complete' && !item.completed) return false;

                    // Score filter
                    if (currentFilters.minScore > 0) {
                        var itemScore = 0;
                        if (item.scoring) {
                            var total = 0;
                            var dimensions = scoringDimensions.map(function(d) { return d.key; });
                            dimensions.forEach(function(dim) {
                                if (item.scoring[dim] !== undefined) total += item.scoring[dim];
                            });
                            itemScore = total / dimensions.length;
                        }
                        if (itemScore < currentFilters.minScore) return false;
                    }

                    // Due date preset filter
                    if (currentFilters.duePreset) {
                        var today = new Date();
                        today.setHours(0, 0, 0, 0);

                        if (currentFilters.duePreset === 'none') {
                            // Show only items with no due date
                            if (item.due_date) return false;
                        } else {
                            // All other presets require a due date
                            if (!item.due_date) return false;

                            var itemDate = new Date(item.due_date);
                            itemDate.setHours(0, 0, 0, 0);

                            switch (currentFilters.duePreset) {
                                case 'overdue':
                                    if (itemDate >= today) return false;
                                    break;
                                case 'today':
                                    if (itemDate.getTime() !== today.getTime()) return false;
                                    break;
                                case 'week':
                                    // Due between today and end of current week (Sunday)
                                    var endOfWeek = new Date(today);
                                    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
                                    if (itemDate < today || itemDate > endOfWeek) return false;
                                    break;
                                case 'month':
                                    // Due between today and end of current month
                                    var endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                                    if (itemDate < today || itemDate > endOfMonth) return false;
                                    break;
                                case 'quarter':
                                    // Due between today and end of current quarter
                                    var currentQuarter = Math.floor(today.getMonth() / 3);
                                    var endOfQuarter = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
                                    if (itemDate < today || itemDate > endOfQuarter) return false;
                                    break;
                            }
                        }
                    }

                    return true;
                };

                // Apply sorting (Pipeline/Board view sorts PROJECTS)
                if (currentFilters.sort && currentFilters.sort.startsWith('project-')) {
                    kanban.options.customSort = function(a, b) {
                        switch (currentFilters.sort) {
                            case 'project-score-desc':
                            case 'project-score-asc':
                                var scoreA = 0, scoreB = 0;
                                var dimensions = scoringDimensions.map(function(d) { return d.key; });
                                if (a.scoring) {
                                    var totalA = 0;
                                    dimensions.forEach(function(dim) { if (a.scoring[dim] !== undefined) totalA += a.scoring[dim]; });
                                    scoreA = totalA / dimensions.length;
                                }
                                if (b.scoring) {
                                    var totalB = 0;
                                    dimensions.forEach(function(dim) { if (b.scoring[dim] !== undefined) totalB += b.scoring[dim]; });
                                    scoreB = totalB / dimensions.length;
                                }
                                return currentFilters.sort === 'project-score-desc' ? scoreB - scoreA : scoreA - scoreB;

                            case 'project-due-asc':
                            case 'project-due-desc':
                                var dateA = a.due_date ? new Date(a.due_date) : new Date('9999-12-31');
                                var dateB = b.due_date ? new Date(b.due_date) : new Date('9999-12-31');
                                return currentFilters.sort === 'project-due-asc' ? dateA - dateB : dateB - dateA;

                            case 'project-assignee':
                                var assigneeA = (a.assignee || 'zzz').toLowerCase();
                                var assigneeB = (b.assignee || 'zzz').toLowerCase();
                                return assigneeA.localeCompare(assigneeB);
                        }
                        return 0;
                    };
                } else {
                    kanban.options.customSort = null;
                }

                // Re-render based on current view mode
                if (currentViewMode === 'mytasks') {
                    renderMyTasksView();
                } else if (currentViewMode === 'timeline') {
                    renderTimelineView();
                } else {
                    // Pipeline/board view
                    kanban.setBoards(kanban.options.boards);
                    addEditItemButton(framework, kanban);
                    addMoveElementButton(framework, kanban);
                }
            };

            // Event handlers
            $(assigneeSelect).change(applyFilters);
            $(statusSelect).change(applyFilters);
            $(sortSelect).change(applyFilters);
            $(scoreMin).on('input', function() {
                var val = $(this).val();
                $(scoreValue).text(val);
                applyFilters();
            });
            $(duePresetSelect).change(applyFilters);

            // Function to update filter/sort visibility based on current view
            var updateFilterVisibilityForView = function(viewMode) {
                // Show all filter rows by default
                $assigneeFilterDiv.show();
                $statusFilterDiv.show();
                $dueFilterDiv.show();
                $scoreFilterDiv.show();

                if (viewMode === 'mytasks') {
                    // ========== TASKS VIEW ==========
                    // Tasks don't have scores, so hide score filter and reset its value
                    $scoreFilterDiv.hide();
                    if (currentFilters.minScore > 0) {
                        currentFilters.minScore = 0;
                        $(scoreMin).val(0);
                        $(scoreValue).text('0');
                    }

                    // Show task sort options, hide project sort options
                    $projectSortOptions.hide();
                    $taskSortOptions.show();

                    // If currently sorting by project field, reset to default
                    if (currentFilters.sort && currentFilters.sort.startsWith('project-')) {
                        $sortSelect.val('');
                        currentFilters.sort = '';
                    }
                } else {
                    // ========== PIPELINE / TIMELINE VIEW ==========
                    // Show project sort options, hide task sort options
                    $projectSortOptions.show();
                    $taskSortOptions.hide();

                    // If currently sorting by task field, reset to default
                    if (currentFilters.sort && currentFilters.sort.startsWith('task-')) {
                        $sortSelect.val('');
                        currentFilters.sort = '';
                    }
                }
            };

            // Visibility filter event handlers
            $(visibilityFilterToggle).on('click', '.cp-kanban-visibility-btn', function() {
                var newVisibility = $(this).attr('data-visibility');
                if (newVisibility !== currentFilters.visibility) {
                    currentFilters.visibility = newVisibility;
                    // Update button active states
                    $(visibilityFilterToggle).find('.cp-kanban-visibility-btn').removeClass('active');
                    $(this).addClass('active');
                    // Apply filters to kanban view
                    applyFilters();
                    // Also re-render other views if currently in them
                    if (currentViewMode === 'mytasks') {
                        renderMyTasksView();
                    } else if (currentViewMode === 'timeline') {
                        renderTimelineView();
                    }
                }
            });

            // Update assignee dropdown when board changes
            onRemoteChange.reg(function() {
                updateAssigneeDropdown();
            });

            updateAssigneeDropdown();

            var hint = h('span.cp-kanban-filterTags-name', Messages.kanban_tags);
            var tags = h('div.cp-kanban-filterTags', [
                h('span.cp-kanban-filterTags-toggle', [
                    hint,
                    reset,
                ]),
                list,
            ]);

            var $reset = $(reset);
            var $list = $(list);
            var $hint = $(hint);

            var setTagFilterState = function (bool) {
                //$hint.toggle(!bool);
                //$reset.toggle(!!bool);
                $hint.css('visibility', bool? 'hidden': 'visible');
                $hint.css('height', bool ? 0 : '');
                $hint.css('padding-top', bool ? 0 : '');
                $hint.css('padding-bottom', bool ? 0 : '');
                $reset.css('visibility', bool? 'visible': 'hidden');
                $reset.css('height', !bool ? 0 : '');
                $reset.css('padding-top', !bool ? 0 : '');
                $reset.css('padding-bottom', !bool ? 0 : '');
            };
            setTagFilterState();

            var getTags = function () {
                return $list.find('span.active').map(function () {
                    return String($(this).data('tag'));
                }).get();
            };

            var commitTags = function () {
                var t = getTags();
                setTagFilterState(t.length);
                //framework._.sfCommon.setPadAttribute('tagsFilter', t);
                kanban.options.tags = t;
                kanban.setBoards(kanban.options.boards);
                addEditItemButton(framework, kanban);
                addMoveElementButton(framework, kanban);
            };

            var redrawList = function (allTags) {
                if (!Array.isArray(allTags)) { return; }
                $list.empty();
                $list.removeClass('cp-empty');
                if (!allTags.length) {
                    $list.addClass('cp-empty');
                    return;
                }
                allTags.forEach(function (t) {
                    var tag;
                    $list.append(tag = h('span', {
                        'data-tag': t,
                        'tabindex': 0,
                        'role': 'button',
                        'aria-pressed': 'false'
                    }, t));
                    var $tag = $(tag).click(function () {
                        if ($tag.hasClass('active')) {
                            $tag.removeClass('active');
                            $tag.attr('aria-pressed', 'false');
                        } else {
                            $tag.addClass('active');
                            $tag.attr('aria-pressed', 'true');
                        }
                        commitTags();
                    }).keydown(function (e) {
                        if (e.which === 13 || e.which === 32) {
                            $tag.click();
                        }
                    });
                });
            };
            redrawList(existing);

            var setTags = function (tags) {
                $list.find('span').removeClass('active');
                if (!Array.isArray(tags)) { return; }
                // Filter out tags that no longer exist (avoid mutation during iteration)
                var filteredTags = tags.filter(function (t) {
                    return existing.indexOf(t) !== -1;
                });
                filteredTags.forEach(function (t) {
                    $list.find('span').filter(function () {
                        return $(this).data('tag') === t;
                    }).addClass('active');
                });
                setTagFilterState(filteredTags.length);
                //framework._.sfCommon.setPadAttribute('tagsFilter', filteredTags);
            };
            setTagFilterState();
            $reset.click(function () {
                setTags([]);
                commitTags();
            });

            let toggleTagsButton = h('button.btn.btn-toolbar-alt.cp-kanban-toggle-tags', {'aria-expanded': 'true', title: 'Show/hide tag filters'}, [
                h('i.fa.fa-tags'),
                h('span', Messages.fm_tagsName)
            ]);
            let toggleContainer = h('div.cp-kanban-toggle-container', toggleTagsButton);

            let toggleClicked = false;
            let $tags = $(tags);
            let $toggleBtn = $(toggleTagsButton);
            let toggle = () => {
                $tags.toggle();
                let visible = $tags.is(':visible');
                $toggleBtn.attr('aria-expanded', visible.toString());
                $(toggleContainer).toggleClass('cp-kanban-container-flex', !visible);
                $toggleBtn.toggleClass('btn-toolbar-alt', visible);
                $toggleBtn.toggleClass('btn-toolbar', !visible);
            };
            $toggleBtn.click(function() {
                toggleClicked = true;
                toggle();
            });

            const resizeTags = () => {
                if (toggleClicked) { return; }
                let visible = $tags.is(':visible');
                // Small screen and visible: hide
                if ($(window).width() < 600) {
                    if (visible) {
                        $(tags).show();
                        toggle();
                    }
                    return;
                }
                // Large screen: make visible by default
                if (visible) { return; }
                $(tags).hide();
                toggle();
            };

            // Use namespaced event for cleanup and prevent duplicates
            $(window).off('resize.kanban').on('resize.kanban', resizeTags);

            var toggleOffclass = 'ontouchstart' in window ? 'cp-toggle-active' : 'cp-toggle-inactive'; 
            var toggleOnclass = 'ontouchstart' in window ? 'cp-toggle-inactive' : 'cp-toggle-active'; 
            var toggleDragOff = h(`button#toggle-drag-off.cp-kanban-view-drag.${toggleOffclass}.fa.fa-arrows`, {'title': Messages.toggleArrows, 'tabindex': 0});
            var toggleDragOn = h(`button#toggle-drag-on.cp-kanban-view-drag.${toggleOnclass}.fa.fa-hand-o-up`, {'title': Messages.toggleDrag, 'tabindex': 0});
            kanban.drag = 'ontouchstart' in window ? false : true;
            const updateDrag = state => {
                return function () {
                    $(toggleDragOn).toggleClass('cp-toggle-active', state).toggleClass('cp-toggle-inactive', !state);
                    $(toggleDragOff).toggleClass('cp-toggle-active', !state).toggleClass('cp-toggle-inactive', state);
                    kanban.drag = state;
                    addMoveElementButton(framework, kanban);
                };
            };
            $(toggleDragOn).click(updateDrag(true));
            $(toggleDragOff).click(updateDrag(false));

            // View mode state and switching
            var currentViewMode = 'board';
            var myTasksContainer = h('div#cp-kanban-mytasks-container');
            var $myTasksContainer = $(myTasksContainer);
            $myTasksContainer.hide();
            // Insert My Tasks container inside the kanban container (sibling to kanban-content)
            // This ensures proper flex layout - both views share same parent
            $('#cp-app-kanban-container').append(myTasksContainer);

            // Timeline/Gantt view container
            var timelineContainer = h('div#cp-kanban-timeline-container');
            var $timelineContainer = $(timelineContainer);
            $timelineContainer.hide();
            $('#cp-app-kanban-container').append(timelineContainer);

            // Timeline state
            var timelineZoom = 'week'; // day, week, month, quarter
            var timelineViewStart = new Date(); // Current view window start date
            timelineViewStart.setHours(0, 0, 0, 0);
            timelineViewStart.setDate(timelineViewStart.getDate() - 7); // Start 1 week before today

            // Get current user's display name
            var getCurrentUserName = function () {
                // Use getUserData().name which is the presence data (same as what toolbar shows)
                var userData = framework._.cpNfInner.metadataMgr.getUserData();
                return userData.name || '';
            };

            // Gather ALL tasks from the document (filtering happens in render)
            var getAllTasks = function () {
                var myNameRaw = getCurrentUserName();
                var myName = (myNameRaw || '').toLowerCase().trim();

                var allTasks = [];
                var boards = kanban.options.boards || {};
                var items = boards.items || {};

                // Build set of active item IDs (items that are in at least one board)
                var activeItemIds = {};
                Object.keys(boards.data || {}).forEach(function (boardId) {
                    var board = boards.data[boardId];
                    if (board && Array.isArray(board.item)) {
                        board.item.forEach(function (itemId) {
                            activeItemIds[itemId] = true;
                        });
                    }
                });

                Object.keys(items).forEach(function (itemId) {
                    // Skip orphaned items (not attached to any board)
                    if (!activeItemIds[itemId]) {
                        return;
                    }

                    var item = items[itemId];
                    if (!Array.isArray(item.tasks)) { return; }

                    // Calculate project score
                    var projectScore = 0;
                    if (item.scoring) {
                        var scoreDimKeys = scoringDimensions.map(function(d) { return d.key; });
                        var totalScore = 0;
                        scoreDimKeys.forEach(function(dim) {
                            if (item.scoring[dim] !== undefined) totalScore += item.scoring[dim];
                        });
                        projectScore = totalScore / scoreDimKeys.length;
                    }

                    item.tasks.forEach(function (task, taskIndex) {
                        var taskAssigneeRaw = task.assignee || '';

                        // Check if assigned to me - handle both single assignee and comma-separated list
                        var isAssignedToMe = false;
                        if (myName && taskAssigneeRaw) {
                            // Split by comma and check each assignee
                            var assigneeList = taskAssigneeRaw.split(',').map(function(a) {
                                return a.toLowerCase().trim();
                            }).filter(function(a) { return a; });
                            isAssignedToMe = assigneeList.indexOf(myName) !== -1;
                        }

                        allTasks.push({
                            task: task,
                            taskIndex: taskIndex,
                            projectId: itemId,
                            projectTitle: item.title || 'Untitled Project',
                            projectDueDate: item.due_date || null,
                            taskDueDate: task.due_date || null,
                            // Effective due date: task's own due date, or fall back to project
                            effectiveDueDate: task.due_date || item.due_date || null,
                            projectScore: projectScore,
                            isAssignedToMe: isAssignedToMe
                        });
                    });
                });

                // Sort: incomplete first, then by effective due date (earliest first, no date last)
                allTasks.sort(function (a, b) {
                    // First sort by done status
                    if (a.task.done !== b.task.done) {
                        return a.task.done ? 1 : -1;
                    }
                    // Then sort by effective due date (task or project)
                    var dateA = a.effectiveDueDate ? new Date(a.effectiveDueDate) : new Date('9999-12-31');
                    var dateB = b.effectiveDueDate ? new Date(b.effectiveDueDate) : new Date('9999-12-31');
                    return dateA - dateB;
                });

                return allTasks;
            };

            // Render My Tasks view - uses shared currentFilters
            var renderMyTasksView = function () {
                $myTasksContainer.empty();
                var allDocTasks = getAllTasks();

                // Apply filters from shared currentFilters
                var displayTasks = allDocTasks;
                displayTasks = displayTasks.filter(function (td) {
                    var task = td.task;

                    // Assignee filter (case-insensitive)
                    if (currentFilters.assignee) {
                        var filterAssigneeLower = currentFilters.assignee.toLowerCase();
                        var taskAssignees = (task.assignee || '').split(',').map(function(a) { return a.trim().toLowerCase(); });
                        if (taskAssignees.indexOf(filterAssigneeLower) === -1) { return false; }
                    }

                    // Status filter (Tasks view only)
                    if (currentFilters.status === 'incomplete' && task.done) { return false; }
                    if (currentFilters.status === 'complete' && !task.done) { return false; }

                    // Due date preset filter (uses task's due date, or falls back to project's due date)
                    if (currentFilters.duePreset) {
                        var today = new Date();
                        today.setHours(0, 0, 0, 0);
                        var dueDate = td.effectiveDueDate; // Task date or project date

                        if (currentFilters.duePreset === 'none') {
                            if (dueDate) { return false; }
                        } else {
                            if (!dueDate) { return false; }
                            var taskDate = new Date(dueDate);
                            taskDate.setHours(0, 0, 0, 0);

                            switch (currentFilters.duePreset) {
                                case 'overdue':
                                    if (taskDate >= today) { return false; }
                                    break;
                                case 'today':
                                    if (taskDate.getTime() !== today.getTime()) { return false; }
                                    break;
                                case 'week':
                                    // Due between today and end of current week
                                    var endOfWeek = new Date(today);
                                    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
                                    if (taskDate < today || taskDate > endOfWeek) { return false; }
                                    break;
                                case 'month':
                                    // Due between today and end of current month
                                    var endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                                    if (taskDate < today || taskDate > endOfMonth) { return false; }
                                    break;
                                case 'quarter':
                                    // Due between today and end of current quarter
                                    var currentQuarter = Math.floor(today.getMonth() / 3);
                                    var endOfQuarter = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
                                    if (taskDate < today || taskDate > endOfQuarter) { return false; }
                                    break;
                            }
                        }
                    }

                    return true;
                });

                // Apply sorting (Tasks view sorts TASKS)
                if (currentFilters.sort && currentFilters.sort.startsWith('task-')) {
                    displayTasks.sort(function (a, b) {
                        switch (currentFilters.sort) {
                            case 'task-due-asc':
                            case 'task-due-desc':
                                // Use task's effective due date (task date or project date fallback)
                                var dueDateA = a.effectiveDueDate ? new Date(a.effectiveDueDate) : new Date('9999-12-31');
                                var dueDateB = b.effectiveDueDate ? new Date(b.effectiveDueDate) : new Date('9999-12-31');
                                return currentFilters.sort === 'task-due-asc' ? dueDateA - dueDateB : dueDateB - dueDateA;

                            case 'task-assignee':
                                var assigneeA = (a.task.assignee || 'zzz').toLowerCase();
                                var assigneeB = (b.task.assignee || 'zzz').toLowerCase();
                                return assigneeA.localeCompare(assigneeB);

                            case 'task-project':
                                // Sort by parent project title
                                var projectA = (a.projectTitle || 'zzz').toLowerCase();
                                var projectB = (b.projectTitle || 'zzz').toLowerCase();
                                return projectA.localeCompare(projectB);
                        }
                        return 0;
                    });
                }

                // Tasks view uses shared FILTERS dropdown - no inline filter UI
                // Filtering is done via currentFilters which are shared across all views

                // Helper to format relative due date
                var formatRelativeDueDate = function (dateStr) {
                    if (!dateStr) { return ''; }
                    var dateObj = new Date(dateStr);
                    if (isNaN(dateObj.getTime())) { return ''; }

                    var today = new Date();
                    today.setHours(0, 0, 0, 0);
                    dateObj.setHours(0, 0, 0, 0);

                    var diffMs = dateObj - today;
                    var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

                    if (diffDays < 0) {
                        var overdueDays = Math.abs(diffDays);
                        if (overdueDays === 1) { return 'Overdue by 1 day'; }
                        if (overdueDays < 7) { return 'Overdue by ' + overdueDays + ' days'; }
                        if (overdueDays < 30) {
                            var weeks = Math.round(overdueDays / 7);
                            return 'Overdue by ' + weeks + ' week' + (weeks !== 1 ? 's' : '');
                        }
                        var months = Math.round(overdueDays / 30);
                        return 'Overdue by ' + months + ' month' + (months !== 1 ? 's' : '');
                    } else if (diffDays === 0) {
                        return 'Due today';
                    } else if (diffDays === 1) {
                        return 'Due tomorrow';
                    } else if (diffDays < 7) {
                        return 'Due in ' + diffDays + ' days';
                    } else if (diffDays < 30) {
                        var weeksAhead = Math.round(diffDays / 7);
                        return 'Due in ' + weeksAhead + ' week' + (weeksAhead !== 1 ? 's' : '');
                    } else {
                        var monthsAhead = Math.round(diffDays / 30);
                        return 'Due in ' + monthsAhead + ' month' + (monthsAhead !== 1 ? 's' : '');
                    }
                };

                // Helper to get due date urgency class
                var getDueDateUrgencyClass = function (dateStr) {
                    if (!dateStr) { return ''; }
                    var dateObj = new Date(dateStr);
                    if (isNaN(dateObj.getTime())) { return ''; }

                    var today = new Date();
                    today.setHours(0, 0, 0, 0);
                    dateObj.setHours(0, 0, 0, 0);

                    var diffMs = dateObj - today;
                    var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

                    if (diffDays < 0) { return 'cp-due-overdue'; } // Overdue - red
                    if (diffDays <= 1) { return 'cp-due-urgent'; } // Today/tomorrow - red
                    if (diffDays <= 7) { return 'cp-due-soon'; }   // Within a week - orange
                    return 'cp-due-later'; // More than a week - neutral
                };

                // Helper to create a task row with edit/delete capabilities
                var createTaskRow = function (taskData) {
                    var task = taskData.task;
                    var checkbox = h('input.cp-mytasks-checkbox', {
                        type: 'checkbox'
                    });
                    checkbox.checked = !!task.done;

                    var projectLink = h('span.cp-mytasks-project', taskData.projectTitle);

                    // Task due date (task's own date, or project date as fallback)
                    var effectiveDueDate = taskData.effectiveDueDate;
                    var dueDateText = formatRelativeDueDate(effectiveDueDate);
                    var dueDateUrgencyClass = getDueDateUrgencyClass(effectiveDueDate);
                    var dueDateSpan = null;
                    if (dueDateText) {
                        dueDateSpan = h('span.cp-mytasks-due' + (dueDateUrgencyClass ? '.' + dueDateUrgencyClass : ''), dueDateText);
                    }

                    // Task title - make editable on double-click
                    var titleSpan = h('span.cp-mytasks-title', task.title || 'Untitled task');
                    var titleInput = h('input.cp-mytasks-title-input', {
                        type: 'text',
                        value: task.title || ''
                    });
                    $(titleInput).hide();

                    // Edit button
                    var editBtn = h('button.cp-mytasks-action-btn.cp-mytasks-edit-btn', {
                        title: 'Edit task'
                    }, [h('i.fa.fa-pencil')]);

                    // Delete button
                    var deleteBtn = h('button.cp-mytasks-action-btn.cp-mytasks-delete-btn', {
                        title: 'Delete task'
                    }, [h('i.fa.fa-trash')]);

                    // Actions container
                    var actionsContainer = h('div.cp-mytasks-actions', [editBtn, deleteBtn]);

                    var rowClass = 'cp-mytasks-row' + (task.done ? ' cp-mytasks-done' : '');
                    var taskRow = h('div.' + rowClass.replace(/\s+/g, '.'), [
                        checkbox,
                        titleSpan,
                        titleInput,
                        h('span.cp-mytasks-separator', ' — '),
                        projectLink,
                        h('span.cp-mytasks-spacer'), // Flexible spacer to push due date right
                        dueDateSpan,
                        actionsContainer
                    ].filter(Boolean));

                    // Checkbox handler
                    $(checkbox).on('change', function () {
                        var boards = kanban.options.boards || {};
                        var item = boards.items[taskData.projectId];
                        if (!item || !Array.isArray(item.tasks)) { return; }

                        var currentTasks = item.tasks.slice();
                        if (currentTasks[taskData.taskIndex]) {
                            currentTasks[taskData.taskIndex] = Object.assign({}, currentTasks[taskData.taskIndex], {
                                done: this.checked
                            });
                            item.tasks = currentTasks;
                            framework.localChange();
                            updateBoards(framework, kanban, kanban.options.boards);
                            setTimeout(function () {
                                renderMyTasksView();
                            }, 100);
                        }
                    });

                    // Click on project name to open editor
                    $(projectLink).on('click', function () {
                        getItemEditModal(framework, kanban, taskData.projectId);
                    });

                    // Edit button - inline edit mode
                    $(editBtn).on('click', function (e) {
                        e.stopPropagation();
                        $(titleSpan).hide();
                        $(titleInput).show().focus().select();
                    });

                    // Save on enter or blur
                    var saveTaskTitle = function () {
                        var newTitle = $(titleInput).val().trim();
                        if (!newTitle) { newTitle = 'Untitled task'; }

                        var boards = kanban.options.boards || {};
                        var item = boards.items[taskData.projectId];
                        if (!item || !Array.isArray(item.tasks)) { return; }

                        var currentTasks = item.tasks.slice();
                        if (currentTasks[taskData.taskIndex]) {
                            currentTasks[taskData.taskIndex] = Object.assign({}, currentTasks[taskData.taskIndex], {
                                title: newTitle
                            });
                            item.tasks = currentTasks;
                            framework.localChange();
                            updateBoards(framework, kanban, kanban.options.boards);
                            setTimeout(function () {
                                renderMyTasksView();
                            }, 100);
                        }
                    };

                    $(titleInput).on('keydown', function (e) {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            saveTaskTitle();
                        } else if (e.key === 'Escape') {
                            $(titleInput).hide();
                            $(titleSpan).show();
                        }
                    });

                    $(titleInput).on('blur', function () {
                        // Only save if value changed
                        var newTitle = $(titleInput).val().trim();
                        if (newTitle !== (task.title || '')) {
                            saveTaskTitle();
                        } else {
                            $(titleInput).hide();
                            $(titleSpan).show();
                        }
                    });

                    // Delete button
                    $(deleteBtn).on('click', function (e) {
                        e.stopPropagation();
                        if (!confirm('Delete this task?')) { return; }

                        var boards = kanban.options.boards || {};
                        var item = boards.items[taskData.projectId];
                        if (!item || !Array.isArray(item.tasks)) { return; }

                        var currentTasks = item.tasks.slice();
                        currentTasks.splice(taskData.taskIndex, 1);
                        item.tasks = currentTasks;
                        framework.localChange();
                        updateBoards(framework, kanban, kanban.options.boards);
                        setTimeout(function () {
                            renderMyTasksView();
                        }, 100);
                    });

                    return taskRow;
                };

                // Show empty state if no tasks at all in document
                if (allDocTasks.length === 0) {
                    var emptyState = h('div.cp-mytasks-empty', [
                        h('i.fa.fa-check-circle'),
                        h('p', Messages.kanban_noTasksYet), // TODO: Add translation key 'kanban_noTasksYet' = "No tasks in this document yet"
                        h('p', { style: 'font-size: 13px; margin-top: 8px;' }, Messages.kanban_addTaskHint) // TODO: Add translation key 'kanban_addTaskHint' = "Click \"Add Quick Task\" to create a personal task"
                    ]);
                    $myTasksContainer.append(emptyState);
                    return;
                }

                // Show empty state for current filter if no matching tasks
                if (displayTasks.length === 0) {
                    var filterEmptyMsg = Messages.kanban_noTasksMatchFilter; // TODO: Add translation key 'kanban_noTasksMatchFilter' = "No tasks match the current filters"
                    var filterEmptyState = h('div.cp-mytasks-empty', { style: 'padding: 30px 0;' }, [
                        h('i.fa.fa-tasks', { style: 'font-size: 32px; color: #9ca3af; margin-bottom: 10px;' }),
                        h('p', { style: 'color: #9ca3af;' }, filterEmptyMsg)
                    ]);
                    $myTasksContainer.append(filterEmptyState);
                    return;
                }

                // Render filtered tasks
                var tasksList = h('div.cp-mytasks-list');
                displayTasks.forEach(function (taskData) {
                    tasksList.appendChild(createTaskRow(taskData));
                });
                $myTasksContainer.append(tasksList);
            };

            // Timeline/Gantt helper functions
            var getTimelineConfig = function () {
                // visibleUnits: how many units to show in viewport
                // navStep: how many days to move when clicking arrows
                var configs = {
                    day: { unitWidth: 50, format: 'D', headerFormat: 'MMM D', daysPerUnit: 1, visibleUnits: 14, navStep: 7 },
                    week: { unitWidth: 120, format: 'W', headerFormat: 'MMM D', daysPerUnit: 7, visibleUnits: 8, navStep: 14 },
                    month: { unitWidth: 140, format: 'M', headerFormat: 'MMM YYYY', daysPerUnit: 30, visibleUnits: 6, navStep: 30 },
                    quarter: { unitWidth: 180, format: 'Q', headerFormat: 'Q# YYYY', daysPerUnit: 90, visibleUnits: 4, navStep: 90 }
                };
                return configs[timelineZoom] || configs.week;
            };

            var parseDate = function (dateStr) {
                if (!dateStr) { return null; }
                var d = new Date(dateStr);
                return isNaN(d.getTime()) ? null : d;
            };

            var formatDateShort = function (date) {
                if (!date) { return ''; }
                var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return months[date.getMonth()] + ' ' + date.getDate();
            };

            var daysBetween = function (date1, date2) {
                var oneDay = 24 * 60 * 60 * 1000;
                return Math.floor((date2 - date1) / oneDay);
            };

            // Render Timeline/Gantt view
            var renderTimelineView = function () {
                // Cleanup any existing timeline event handlers before re-render
                $(document).off('.timeline-resize');
                $(document).off('.timeline-move');
                $timelineContainer.empty();
                var config = getTimelineConfig();

                // Gather all projects with dates
                var boards = kanban.options.boards || {};
                var items = boards.items || {};
                var projects = [];

                // Build set of active item IDs (items that are in at least one board)
                var activeItemIds = {};
                Object.keys(boards.data || {}).forEach(function (boardId) {
                    var board = boards.data[boardId];
                    if (board && Array.isArray(board.item)) {
                        board.item.forEach(function (itemId) {
                            activeItemIds[itemId] = true;
                        });
                    }
                });

                // Helper to calculate project score
                var getProjectScore = function(item) {
                    if (!item.scoring) return 0;
                    var total = 0;
                    var dimensions = scoringDimensions.map(function(d) { return d.key; });
                    dimensions.forEach(function(dim) {
                        if (item.scoring[dim] !== undefined) total += item.scoring[dim];
                    });
                    return total / dimensions.length;
                };

                // Helper to check due date filter
                var passesDateFilter = function(dateStr, preset) {
                    if (!preset) return true;
                    var today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (preset === 'none') {
                        return !dateStr;
                    }
                    if (!dateStr) return false;

                    var itemDate = new Date(dateStr);
                    itemDate.setHours(0, 0, 0, 0);

                    switch (preset) {
                        case 'overdue':
                            return itemDate < today;
                        case 'today':
                            return itemDate.getTime() === today.getTime();
                        case 'week':
                            // Due between today and end of current week
                            var endOfWeek = new Date(today);
                            endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
                            return itemDate >= today && itemDate <= endOfWeek;
                        case 'month':
                            // Due between today and end of current month
                            var endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                            return itemDate >= today && itemDate <= endOfMonth;
                        case 'quarter':
                            // Due between today and end of current quarter
                            var currentQuarter = Math.floor(today.getMonth() / 3);
                            var endOfQuarter = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
                            return itemDate >= today && itemDate <= endOfQuarter;
                    }
                    return true;
                };

                // Apply all filters consistently with other views
                Object.keys(items).forEach(function (itemId) {
                    // Skip orphaned items
                    if (!activeItemIds[itemId]) { return; }

                    var item = items[itemId];

                    // Apply assignee filter (case-insensitive)
                    if (currentFilters.assignee) {
                        if (!item.assignee) return;
                        var filterAssigneeLower = currentFilters.assignee.toLowerCase();
                        var itemAssignees = item.assignee.split(',').map(function(a) { return a.trim().toLowerCase(); });
                        if (itemAssignees.indexOf(filterAssigneeLower) === -1) return;
                    }

                    // Apply status filter (project completion)
                    if (currentFilters.status === 'incomplete' && item.completed) return;
                    if (currentFilters.status === 'complete' && !item.completed) return;

                    // Apply score filter
                    if (currentFilters.minScore > 0) {
                        if (getProjectScore(item) < currentFilters.minScore) return;
                    }

                    // Apply due date filter
                    if (!passesDateFilter(item.due_date, currentFilters.duePreset)) return;

                    projects.push({
                        id: itemId,
                        title: item.title || 'Untitled',
                        start_date: parseDate(item.start_date),
                        due_date: parseDate(item.due_date),
                        due_date_raw: item.due_date, // Keep raw for sorting
                        completed: item.completed,
                        score: getProjectScore(item),
                        assignee: item.assignee || '',
                        tasks: item.tasks || [],
                        color: item.color || ''
                    });
                });

                // Apply sorting (Timeline view sorts PROJECTS)
                if (currentFilters.sort && currentFilters.sort.startsWith('project-')) {
                    projects.sort(function (a, b) {
                        switch (currentFilters.sort) {
                            case 'project-score-desc':
                            case 'project-score-asc':
                                var scoreA = a.score || 0;
                                var scoreB = b.score || 0;
                                return currentFilters.sort === 'project-score-desc' ? scoreB - scoreA : scoreA - scoreB;

                            case 'project-due-asc':
                            case 'project-due-desc':
                                var dateA = a.due_date_raw ? new Date(a.due_date_raw) : new Date('9999-12-31');
                                var dateB = b.due_date_raw ? new Date(b.due_date_raw) : new Date('9999-12-31');
                                return currentFilters.sort === 'project-due-asc' ? dateA - dateB : dateB - dateA;

                            case 'project-assignee':
                                var assigneeA = (a.assignee || 'zzz').toLowerCase();
                                var assigneeB = (b.assignee || 'zzz').toLowerCase();
                                return assigneeA.localeCompare(assigneeB);
                        }
                        return 0;
                    });
                } else {
                    // Default sort: by due date ascending (soonest first)
                    projects.sort(function (a, b) {
                        var dateA = a.due_date_raw ? new Date(a.due_date_raw) : new Date('9999-12-31');
                        var dateB = b.due_date_raw ? new Date(b.due_date_raw) : new Date('9999-12-31');
                        return dateA - dateB;
                    });
                }

                // Calculate viewport window - fixed width based on visible units
                var today = new Date();
                today.setHours(0, 0, 0, 0);

                // Viewport dates based on current view start
                var viewportStart = new Date(timelineViewStart);
                var viewportEnd = new Date(viewportStart);
                var viewportDays = config.visibleUnits * config.daysPerUnit;
                viewportEnd.setDate(viewportEnd.getDate() + viewportDays);

                // Fixed viewport width
                var viewportWidth = config.visibleUnits * config.unitWidth;

                // Build zoom controls
                var zoomLabels = {
                    day: 'View by day',
                    week: 'View by week',
                    month: 'View by month',
                    quarter: 'View by quarter'
                };
                var zoomBtns = ['day', 'week', 'month', 'quarter'].map(function (z) {
                    var btn = h('button.cp-timeline-zoom-btn' + (timelineZoom === z ? '.active' : ''), { title: zoomLabels[z] }, z.charAt(0).toUpperCase() + z.slice(1));
                    $(btn).on('click', function () {
                        timelineZoom = z;
                        renderTimelineView();
                    });
                    return btn;
                });

                // Navigation arrows
                var navPrev = h('button.cp-timeline-nav-btn.cp-timeline-nav-prev', { title: 'Previous' }, [
                    h('i.fa.fa-chevron-left')
                ]);
                var navNext = h('button.cp-timeline-nav-btn.cp-timeline-nav-next', { title: 'Next' }, [
                    h('i.fa.fa-chevron-right')
                ]);

                $(navPrev).on('click', function () {
                    timelineViewStart.setDate(timelineViewStart.getDate() - config.navStep);
                    renderTimelineView();
                });
                $(navNext).on('click', function () {
                    timelineViewStart.setDate(timelineViewStart.getDate() + config.navStep);
                    renderTimelineView();
                });

                var todayBtn = h('button.cp-timeline-today-btn', { title: 'Jump to today' }, [
                    h('i.fa.fa-crosshairs'),
                    ' Today'
                ]);
                $(todayBtn).on('click', function () {
                    timelineViewStart = new Date();
                    timelineViewStart.setHours(0, 0, 0, 0);
                    timelineViewStart.setDate(timelineViewStart.getDate() - Math.floor(config.visibleUnits * config.daysPerUnit / 3));
                    renderTimelineView();
                });

                // Date range label
                var dateRangeLabel = h('span.cp-timeline-date-range',
                    formatDateShort(viewportStart) + ' - ' + formatDateShort(viewportEnd)
                );

                var zoomControls = h('div.cp-timeline-controls', [
                    h('div.cp-timeline-nav-group', [navPrev, dateRangeLabel, navNext]),
                    h('div.cp-timeline-zoom-group', zoomBtns),
                    todayBtn
                ]);

                // Build header with date columns - only for visible viewport
                var headerCells = [];
                var currentDate = new Date(viewportStart);
                for (var unitIdx = 0; unitIdx < config.visibleUnits; unitIdx++) {
                    var cellDate = new Date(currentDate);
                    var isToday = cellDate.toDateString() === today.toDateString();
                    var headerText = formatDateShort(cellDate);

                    if (timelineZoom === 'week') {
                        headerText = formatDateShort(cellDate);
                        currentDate.setDate(currentDate.getDate() + 7);
                    } else if (timelineZoom === 'month') {
                        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        headerText = months[cellDate.getMonth()] + ' ' + cellDate.getFullYear();
                        currentDate.setMonth(currentDate.getMonth() + 1);
                    } else if (timelineZoom === 'quarter') {
                        var q = Math.floor(cellDate.getMonth() / 3) + 1;
                        headerText = 'Q' + q + ' ' + cellDate.getFullYear();
                        currentDate.setMonth(currentDate.getMonth() + 3);
                    } else {
                        // day
                        headerText = cellDate.getDate() + '';
                        currentDate.setDate(currentDate.getDate() + 1);
                    }

                    headerCells.push(h('div.cp-timeline-header-cell' + (isToday ? '.today' : ''), headerText));
                }

                var timelineHeader = h('div.cp-timeline-header', headerCells);

                // Label spacer to align with row labels
                var headerLabelSpacer = h('div.cp-timeline-header-label-spacer');

                // Build today marker (only if today is visible in viewport)
                // Today marker is positioned using calc() to account for the 180px label column
                var todayDaysFromStart = daysBetween(viewportStart, today);
                var todayOffsetPercent = (todayDaysFromStart / viewportDays) * 100;
                var todayMarker = null;
                if (today >= viewportStart && today <= viewportEnd) {
                    // calc(180px + X% of (100% - 180px))
                    todayMarker = h('div.cp-timeline-today-marker', {
                        style: 'left: calc(180px + ' + todayOffsetPercent + ' * (100% - 180px) / 100);'
                    });
                }

                // Build project rows
                var projectRows = [];
                projects.forEach(function (project) {
                    var projectStart = project.start_date || today;
                    var projectEnd = project.due_date || new Date(projectStart.getTime() + 7 * 24 * 60 * 60 * 1000);

                    // Calculate position as percentage of viewport days
                    var startDays = daysBetween(viewportStart, projectStart);
                    var duration = Math.max(1, daysBetween(projectStart, projectEnd));
                    var startPercent = (startDays / viewportDays) * 100;
                    var widthPercent = Math.max((duration / viewportDays) * 100, 2); // min 2%

                    // Skip projects that are completely outside the viewport
                    var endPercent = startPercent + widthPercent;
                    if (endPercent < 0 || startPercent > 100) {
                        // Project is completely outside viewport - still show row but hide bar
                    }

                    var projectBarStyle = 'left: ' + startPercent + '%; width: ' + widthPercent + '%;';
                    if (project.color) {
                        projectBarStyle += ' background-color: ' + project.color + ';';
                        projectBarStyle += ' color: ' + getTextColor(project.color) + ';';
                    }
                    var projectBar = h('div.cp-timeline-bar.cp-timeline-project-bar', {
                        style: projectBarStyle,
                        'data-id': project.id,
                        title: project.title + '\n' + formatDateShort(projectStart) + ' - ' + formatDateShort(projectEnd)
                    }, [
                        h('span.cp-timeline-bar-label', project.title),
                        h('div.cp-timeline-bar-resize-handle.left'),
                        h('div.cp-timeline-bar-resize-handle.right')
                    ]);

                    // Click to edit
                    $(projectBar).on('click', function (e) {
                        if ($(e.target).hasClass('cp-timeline-bar-resize-handle')) { return; }
                        getItemEditModal(framework, kanban, project.id);
                    });

                    // Drag resize and move handlers
                    var setupResizeHandlers = function ($bar, itemId, isTask, taskIndex) {
                        var EDGE_ZONE = 10; // pixels from edge to trigger resize vs move

                        // Update cursor based on mouse position within bar
                        $bar.on('mousemove', function (e) {
                            if ($(e.target).hasClass('cp-timeline-bar-resize-handle')) {
                                $bar.css('cursor', 'ew-resize');
                                return;
                            }
                            var rect = this.getBoundingClientRect();
                            var x = e.clientX - rect.left;
                            if (x < EDGE_ZONE || x > rect.width - EDGE_ZONE) {
                                $bar.css('cursor', 'ew-resize');
                            } else {
                                $bar.css('cursor', 'grab');
                            }
                        });

                        $bar.on('mouseleave', function () {
                            $bar.css('cursor', '');
                        });

                        // Edge resize handlers (existing)
                        $bar.find('.cp-timeline-bar-resize-handle').on('mousedown', function (e) {
                            e.preventDefault();
                            e.stopPropagation();
                            var isLeft = $(this).hasClass('left');
                            var startX = e.pageX;
                            // Get container width for percentage calculations
                            var $container = $bar.parent();
                            var containerWidth = $container.width();
                            // Get current percentage values
                            var origLeftPercent = parseFloat($bar.css('left')) / containerWidth * 100;
                            var origWidthPercent = parseFloat($bar.css('width')) / containerWidth * 100;

                            $bar.css('cursor', 'ew-resize');
                            $bar.addClass('cp-timeline-dragging');

                            $(document).on('mousemove.timeline-resize', function (e) {
                                var dx = e.pageX - startX;
                                var dxPercent = (dx / containerWidth) * 100;
                                if (isLeft) {
                                    var newLeftPercent = origLeftPercent + dxPercent;
                                    var newWidthPercent = origWidthPercent - dxPercent;
                                    if (newWidthPercent > 2) {
                                        $bar.css({ left: newLeftPercent + '%', width: newWidthPercent + '%' });
                                    }
                                } else {
                                    var newWidthPercent = origWidthPercent + dxPercent;
                                    if (newWidthPercent > 2) {
                                        $bar.css('width', newWidthPercent + '%');
                                    }
                                }
                            });

                            $(document).on('mouseup.timeline-resize', function () {
                                $(document).off('.timeline-resize');
                                $bar.removeClass('cp-timeline-dragging');
                                $bar.css('cursor', '');
                                // Calculate new dates from percentage position
                                var newLeftPercent = parseFloat($bar.css('left')) / containerWidth * 100;
                                var newWidthPercent = parseFloat($bar.css('width')) / containerWidth * 100;
                                var newStartDays = (newLeftPercent / 100) * viewportDays;
                                var newDurationDays = (newWidthPercent / 100) * viewportDays;

                                var newStartDate = new Date(viewportStart);
                                newStartDate.setDate(newStartDate.getDate() + Math.floor(newStartDays));
                                var newEndDate = new Date(newStartDate);
                                newEndDate.setDate(newEndDate.getDate() + Math.floor(newDurationDays));

                                // Update the item
                                var boards = kanban.options.boards || {};
                                if (isTask) {
                                    var item = boards.items[itemId];
                                    if (item && item.tasks && item.tasks[taskIndex]) {
                                        var currentTasks = item.tasks.slice();
                                        currentTasks[taskIndex] = Object.assign({}, currentTasks[taskIndex], {
                                            start_date: newStartDate.toISOString().split('T')[0],
                                            due_date: newEndDate.toISOString().split('T')[0]
                                        });
                                        item.tasks = currentTasks;
                                    }
                                } else {
                                    var item = boards.items[itemId];
                                    if (item) {
                                        item.start_date = newStartDate.toISOString().split('T')[0];
                                        item.due_date = newEndDate.toISOString().split('T')[0];
                                    }
                                }
                                framework.localChange();
                                updateBoards(framework, kanban, kanban.options.boards);
                                setTimeout(function () {
                                    renderTimelineView();
                                }, 100);
                            });
                        });

                        // Middle-drag to move entire bar (preserves duration)
                        $bar.on('mousedown', function (e) {
                            // Skip if clicking on resize handles
                            if ($(e.target).hasClass('cp-timeline-bar-resize-handle')) { return; }

                            // Check if we're in the middle zone (not near edges)
                            var rect = this.getBoundingClientRect();
                            var x = e.clientX - rect.left;
                            if (x < EDGE_ZONE || x > rect.width - EDGE_ZONE) {
                                // Near edge - let resize handle it or ignore
                                return;
                            }

                            e.preventDefault();
                            e.stopPropagation();

                            var startX = e.pageX;
                            // Get container width for percentage calculations
                            var $container = $bar.parent();
                            var containerWidth = $container.width();
                            var origLeftPercent = parseFloat($bar.css('left')) / containerWidth * 100;
                            var barWidthPercent = parseFloat($bar.css('width')) / containerWidth * 100;

                            $bar.css('cursor', 'grabbing');
                            $bar.addClass('cp-timeline-dragging');

                            $(document).on('mousemove.timeline-move', function (e) {
                                var dx = e.pageX - startX;
                                var dxPercent = (dx / containerWidth) * 100;
                                var newLeftPercent = origLeftPercent + dxPercent;
                                // Prevent dragging off the left edge
                                if (newLeftPercent >= 0) {
                                    $bar.css('left', newLeftPercent + '%');
                                }
                            });

                            $(document).on('mouseup.timeline-move', function () {
                                $(document).off('.timeline-move');
                                $bar.removeClass('cp-timeline-dragging');
                                $bar.css('cursor', '');

                                // Calculate new dates from percentage position (preserving duration)
                                var newLeftPercent = parseFloat($bar.css('left')) / containerWidth * 100;
                                var newStartDays = (newLeftPercent / 100) * viewportDays;
                                var durationDays = (barWidthPercent / 100) * viewportDays;

                                var newStartDate = new Date(viewportStart);
                                newStartDate.setDate(newStartDate.getDate() + Math.floor(newStartDays));
                                var newEndDate = new Date(newStartDate);
                                newEndDate.setDate(newEndDate.getDate() + Math.floor(durationDays));

                                // Update the item
                                var boards = kanban.options.boards || {};
                                if (isTask) {
                                    var item = boards.items[itemId];
                                    if (item && item.tasks && item.tasks[taskIndex]) {
                                        var currentTasks = item.tasks.slice();
                                        currentTasks[taskIndex] = Object.assign({}, currentTasks[taskIndex], {
                                            start_date: newStartDate.toISOString().split('T')[0],
                                            due_date: newEndDate.toISOString().split('T')[0]
                                        });
                                        item.tasks = currentTasks;
                                    }
                                } else {
                                    var item = boards.items[itemId];
                                    if (item) {
                                        item.start_date = newStartDate.toISOString().split('T')[0];
                                        item.due_date = newEndDate.toISOString().split('T')[0];
                                    }
                                }
                                framework.localChange();
                                updateBoards(framework, kanban, kanban.options.boards);
                                setTimeout(function () {
                                    renderTimelineView();
                                }, 100);
                            });
                        });
                    };

                    setupResizeHandlers($(projectBar), project.id, false, null);

                    // Task bars (nested under project)
                    var taskBars = [];
                    project.tasks.forEach(function (task, taskIndex) {
                        var taskStart = parseDate(task.start_date) || projectStart;
                        var taskEnd = parseDate(task.due_date) || new Date(taskStart.getTime() + 3 * 24 * 60 * 60 * 1000);

                        // Calculate task position as percentage of viewport days
                        var taskStartDays = daysBetween(viewportStart, taskStart);
                        var taskDuration = Math.max(1, daysBetween(taskStart, taskEnd));
                        var taskStartPercent = (taskStartDays / viewportDays) * 100;
                        var taskWidthPercent = Math.max((taskDuration / viewportDays) * 100, 1.5); // min 1.5%

                        // Task bar inherits lighter version of parent project color
                        var taskBarStyle = 'left: ' + taskStartPercent + '%; width: ' + taskWidthPercent + '%;';
                        if (project.color) {
                            // Use project color with transparency for task bars
                            taskBarStyle += ' background-color: ' + project.color + '; opacity: 0.7;';
                            taskBarStyle += ' color: ' + getTextColor(project.color) + ';';
                        }

                        var taskBar = h('div.cp-timeline-bar.cp-timeline-task-bar' + (task.done ? '.done' : ''), {
                            style: taskBarStyle,
                            title: (task.title || 'Untitled task') + '\n' + formatDateShort(taskStart) + ' - ' + formatDateShort(taskEnd)
                        }, [
                            h('span.cp-timeline-bar-label', task.title || 'Task'),
                            h('div.cp-timeline-bar-resize-handle.left'),
                            h('div.cp-timeline-bar-resize-handle.right')
                        ]);

                        setupResizeHandlers($(taskBar), project.id, true, taskIndex);

                        taskBars.push(h('div.cp-timeline-task-row', {
                            style: 'width: ' + viewportWidth + 'px;'
                        }, [taskBar]));
                    });

                    var projectRowContent = h('div.cp-timeline-row-content', {
                        style: 'width: ' + viewportWidth + 'px;'
                    }, [projectBar]);

                    var taskCountText = project.tasks.length === 1 ? '1 task' : project.tasks.length + ' tasks';
                    var projectLabel = h('div.cp-timeline-row-label', [
                        h('span.cp-timeline-project-name', project.title),
                        project.tasks.length > 0 ? h('span.cp-timeline-task-count', '· ' + taskCountText) : null
                    ].filter(Boolean));

                    var projectRowEl = h('div.cp-timeline-row.cp-timeline-project-row', [
                        projectLabel,
                        projectRowContent
                    ]);

                    projectRows.push(projectRowEl);

                    // Add task rows
                    if (taskBars.length > 0) {
                        taskBars.forEach(function (taskBar, idx) {
                            var taskLabel = h('div.cp-timeline-row-label.cp-timeline-task-label',
                                project.tasks[idx].title || 'Task ' + (idx + 1)
                            );
                            projectRows.push(h('div.cp-timeline-row.cp-timeline-task-row-container', [
                                taskLabel,
                                taskBar
                            ]));
                        });
                    }
                });

                // Fixed viewport container (no scrolling)
                // Grid has: label spacer (fixed 180px) + header (flex: 1)
                var gridElements = [headerLabelSpacer, timelineHeader];
                if (todayMarker) { gridElements.push(todayMarker); }

                var timelineBody = h('div.cp-timeline-body.cp-timeline-fixed-viewport', [
                    h('div.cp-timeline-grid', gridElements),
                    h('div.cp-timeline-rows', projectRows)
                ]);

                // Header - controls with navigation arrows
                var timelineHeaderSection = h('div.cp-timeline-header-section', [
                    zoomControls
                ]);

                // Empty state if no projects
                if (projects.length === 0) {
                    var emptyState = h('div.cp-timeline-empty', [
                        h('i.fa.fa-calendar-o'),
                        h('p', Messages.kanban_noProjects), // TODO: Add translation key 'kanban_noProjects' = "No projects to display"
                        h('p', { style: 'font-size: 13px;' }, Messages.kanban_createProjectsHint) // TODO: Add translation key 'kanban_createProjectsHint' = "Create projects in Pipeline view to see them here"
                    ]);
                    $timelineContainer.append(timelineHeaderSection);
                    $timelineContainer.append(emptyState);
                    return;
                }

                $timelineContainer.append(timelineHeaderSection);
                $timelineContainer.append(timelineBody);
            };

            // Render current view based on mode
            // Note: We hide #cp-app-kanban-content (not $cContainer) so controls bar stays visible
            var $kanbanContent = $('#cp-app-kanban-content');
            var renderCurrentView = function () {
                // Update filter panel visibility based on view
                updateFilterVisibilityForView(currentViewMode);

                if (currentViewMode === 'board') {
                    // Cleanup timeline event handlers when switching away
                    $(document).off('.timeline-resize');
                    $(document).off('.timeline-move');
                    $kanbanContent.show();
                    $myTasksContainer.hide();
                    $timelineContainer.hide();
                    // Apply filters first to ensure sort/filter state is current
                    applyFilters();
                    // Re-render board to apply any filter changes made in other views
                    kanban.setBoards(kanban.options.boards);
                } else if (currentViewMode === 'mytasks') {
                    // Cleanup timeline event handlers when switching away
                    $(document).off('.timeline-resize');
                    $(document).off('.timeline-move');
                    $kanbanContent.hide();
                    $myTasksContainer.show();
                    $timelineContainer.hide();
                    renderMyTasksView();
                } else if (currentViewMode === 'timeline') {
                    $kanbanContent.hide();
                    $myTasksContainer.hide();
                    $timelineContainer.show();
                    renderTimelineView();
                }
            };

            // View switcher buttons
            var boardViewBtn = h('button.cp-kanban-viewmode-btn.cp-kanban-viewmode-active', {
                'data-mode': 'board',
                title: 'Kanban board view - organize projects into columns'
            }, [
                h('i.fa.fa-columns'),
                ' Pipeline'
            ]);
            var myTasksViewBtn = h('button.cp-kanban-viewmode-btn', {
                'data-mode': 'mytasks',
                title: 'Task list - see all tasks assigned to you'
            }, [
                h('i.fa.fa-check-square-o'),
                ' Tasks'
            ]);
            var timelineViewBtn = h('button.cp-kanban-viewmode-btn', {
                'data-mode': 'timeline',
                title: 'Gantt chart - visualize project timelines'
            }, [
                h('i.fa.fa-bars'),
                ' Timeline'
            ]);

            var viewSwitcher = h('div.cp-kanban-view-switcher', [
                boardViewBtn,
                timelineViewBtn,
                myTasksViewBtn
            ]);

            var setActiveViewBtn = function (mode) {
                $(boardViewBtn).removeClass('cp-kanban-viewmode-active');
                $(myTasksViewBtn).removeClass('cp-kanban-viewmode-active');
                $(timelineViewBtn).removeClass('cp-kanban-viewmode-active');
                if (mode === 'board') {
                    $(boardViewBtn).addClass('cp-kanban-viewmode-active');
                } else if (mode === 'mytasks') {
                    $(myTasksViewBtn).addClass('cp-kanban-viewmode-active');
                } else if (mode === 'timeline') {
                    $(timelineViewBtn).addClass('cp-kanban-viewmode-active');
                }
            };

            $(boardViewBtn).on('click', function () {
                if (currentViewMode === 'board') { return; }
                currentViewMode = 'board';
                setActiveViewBtn('board');
                renderCurrentView();
            });

            $(myTasksViewBtn).on('click', function () {
                if (currentViewMode === 'mytasks') { return; }
                currentViewMode = 'mytasks';
                setActiveViewBtn('mytasks');
                renderCurrentView();
            });

            $(timelineViewBtn).on('click', function () {
                if (currentViewMode === 'timeline') { return; }
                currentViewMode = 'timeline';
                setActiveViewBtn('timeline');
                renderCurrentView();
            });

            // Re-render current view when remote changes occur (if in that view)
            onRemoteChange.reg(function () {
                if (currentViewMode === 'mytasks') {
                    renderMyTasksView();
                } else if (currentViewMode === 'timeline') {
                    renderTimelineView();
                }
            });

            // Collapsible filter panel (tags filter removed)
            var filterPanelContent = h('div.cp-kanban-filter-panel-content', [
                visibilityFilterToggle,
                advancedFilters
            ]);
            var $filterPanelContent = $(filterPanelContent);
            $filterPanelContent.hide(); // Hidden by default

            var filterIndicator = h('span.cp-kanban-filter-indicator');
            var $filterIndicator = $(filterIndicator);
            $filterIndicator.hide();

            var filterToggleBtn = h('button.btn.btn-toolbar.cp-kanban-filter-toggle', {
                title: 'Toggle filter panel'
            }, [
                h('i.fa.fa-filter'),
                h('span', ' Filters'),
                filterIndicator
            ]);
            var $filterToggleBtn = $(filterToggleBtn);

            // Update filter indicator when filters are active
            var updateFilterIndicator = function() {
                var hasActiveFilters = false;
                // Check advanced filters (tags removed)
                if (currentFilters.assignee || currentFilters.status || currentFilters.minScore > 0 || currentFilters.duePreset) {
                    hasActiveFilters = true;
                }
                if (hasActiveFilters) {
                    $filterIndicator.show();
                } else {
                    $filterIndicator.hide();
                }
            };

            $filterToggleBtn.on('click', function() {
                $filterPanelContent.slideToggle(150);
                $filterToggleBtn.toggleClass('cp-filter-expanded');
            });

            // Hook into filter changes to update indicator
            var originalApplyFilters = applyFilters;
            applyFilters = function() {
                originalApplyFilters();
                updateFilterIndicator();
            };

            var filterPanel = h('div.cp-kanban-filter-panel', [
                filterToggleBtn,
                filterPanelContent
            ]);

            // Update card detail visibility after any redraw (respects compact mode)
            onRedraw.reg(function() {
                updateCardDetailVisibility();
            });

            var container = h('div#cp-kanban-controls', [
                viewSwitcher,
                filterPanel,
                h('div.cp-kanban-changeView.drag', [
                    toggleDragOff,
                    toggleDragOn
                ]),
                h('div.cp-kanban-changeView', [
                    small,
                    big
                ])
            ]);
            $container.before(container);

            onRedraw.reg(function () {
                // Redraw if new tags have been added to items
                var old = Sortify(existing);
                var t = getTags();
                existing = getExistingTags(kanban.options.boards);
                if (old === Sortify(existing)) { return; } // No change
                // New tags:
                redrawList(existing);
                setTags(t);
            });
            /*
            framework._.sfCommon.getPadAttribute('tagsFilter', function (err, res) {
                if (!err && Array.isArray(res)) {
                    setTags(res);
                    commitTags();
                }
            });
            framework._.sfCommon.getPadAttribute('quickMode', function (err, res) {
                if (!err && res) {
                    $cContainer.addClass('cp-kanban-quick');
                }
            });
            */
        };
        addControls();

        return kanban;
    };

    var mkHelpMenu = function (framework) {
        var $toolbarContainer = $('#cp-app-kanban-container');

        var helpMenu = framework._.sfCommon.createHelpMenu(['kanban']);

        var $helpMenuButton = UIElements.getEntryFromButton(helpMenu.button);
        $toolbarContainer.prepend(helpMenu.menu);
        framework._.toolbar.$drawer.append($helpMenuButton);
    };


    // Start of the main loop
    var andThen2 = function (framework) {

        var kanban;
        var $container = $('#cp-app-kanban-content');

        var privateData = framework._.cpNfInner.metadataMgr.getPrivateData();
        if (!privateData.isEmbed) {
            mkHelpMenu(framework);
        }

        if (framework.isReadOnly() || framework.isLocked()) {
            $container.addClass('cp-app-readonly');
        }

        var cleanData = function (boards) {
            if (typeof(boards) !== "object") { return; }
            var items = boards.items || {};
            var data = boards.data || {};
            var list = boards.list || [];

            // Remove duplicate boards
            list = boards.list = Util.deduplicateString(list);

            Object.keys(data).forEach(function (id) {
                if (list.indexOf(Number(id)) === -1) {
                    list.push(Number(id));
                }
                // Remove duplicate items
                var b = data[id];
                b.item = Util.deduplicateString(b.item || []);
            });
            Object.keys(items).forEach(function (eid) {
                var exists = Object.keys(data).some(function (id) {
                    return (data[id].item || []).indexOf(Number(eid)) !== -1;
                });
                if (!exists) { delete items[eid]; }
            });
            framework.localChange();
        };

        framework.setFileImporter({accept: ['.json', 'application/json']}, function (content /*, file */) {
            var parsed;
            try { parsed = JSON.parse(content); }
            catch (e) { return void console.error(e); }

            if (parsed && parsed.id && parsed.lists && parsed.cards) {
                return { content: Export.import(parsed) };
            }

            return { content: parsed };
        });

        framework.setFileExporter('.json', function () {
            var content = kanban.getBoardsJSON();
            cleanData(content);
            return new Blob([JSON.stringify(kanban.getBoardsJSON(), 0, 2)], {
                type: 'application/json',
            });
        });

        framework.onEditableChange(function (unlocked) {
            if (framework.isReadOnly()) { return; }
            if (!kanban) { return; }
            if (unlocked) {
                addEditItemButton(framework, kanban);
                addMoveElementButton(framework, kanban);
                kanban.options.readOnly = false;
                return void $container.removeClass('cp-app-readonly');
            }
            kanban.options.readOnly = true;
            $container.addClass('cp-app-readonly');
            $container.find('.kanban-edit-item').remove();
        });

        getCursor = function () {
            if (!kanban || !kanban.inEditMode) { return; }
            try {
                var id = kanban.inEditMode;
                var newBoard;
                var $el = $container.find('[data-id="'+id+'"]');
                if (id === "new") {
                    $el = $container.find('.kanban-item.new-item');
                    newBoard = $el.closest('.kanban-board').attr('data-id');
                } else if (!$el.length) {
                    $el = $container.find('[data-eid="'+id+'"]');
                }
                var isTop = $el && $el.hasClass('item-top');
                if (!$el.length) { return; }
                var $input = $el.find('input');
                if (!$input.length) { return; }
                var input = $input[0];

                var val = ($input.val && $input.val()) || '';
                var start = input.selectionStart;
                var end = input.selectionEnd;

                var json = kanban.getBoardJSON(id) || kanban.getItemJSON(id);
                var oldVal = json && json.title;

                if (id === "new") { $el.remove(); }

                return {
                    id: id,
                    newBoard: newBoard,
                    value: val,
                    start: start,
                    end: end,
                    isTop: isTop,
                    oldValue: oldVal
                };
            } catch (e) {
                console.error(e);
                return {};
            }
        };
        restoreCursor = function (data) {
            if (!data) { return; }
            try {
                var id = data.id;

                // An item was being added: add a new item
                if (id === "new" && !data.oldValue) {
                    var $newBoard = $('.kanban-board[data-id="'+data.newBoard+'"]');
                    var topSelector = ':not([data-top])';
                    if (data.isTop) { topSelector = '[data-top]'; }
                    $newBoard.find('.kanban-title-button' + topSelector).click();
                    var $newInput = $newBoard.find('.kanban-item.new-item input');
                    $newInput.val(data.value);
                    $newInput[0].selectionStart = data.start;
                    $newInput[0].selectionEnd = data.end;
                    return;
                }

                // Edit a board title or a card title
                var $el = $container.find('.kanban-board[data-id="'+id+'"]');
                if (!$el.length) {
                    $el = $container.find('.kanban-item[data-eid="'+id+'"]');
                }
                if (!$el.length) { return; }

                var isBoard = true;
                var json = kanban.getBoardJSON(id);
                if (!json) {
                    isBoard = false;
                    json = kanban.getItemJSON(id);
                }
                if (!json) { return; }

                // Editing a board or card title...
                $el.find(isBoard ? '.kanban-title-board' : '.kanban-item-text').click();
                var $input = $el.find('input');
                if (!$input.length) { return; }

                // if the value was changed by a remote user, abort
                setValueAndCursor($input[0], json.title, {
                    value: data.value,
                    selectionStart: data.start,
                    selectionEnd: data.end
                });
            } catch (e) {
                console.error(e);
                return;
            }
        };

        framework.onContentUpdate(function (newContent) {
            // Init if needed
            if (!kanban) {
                kanban = initKanban(framework, (newContent || {}).content);
                addEditItemButton(framework, kanban);
                addMoveElementButton(framework, kanban);
                return;
            }

            // Need to update the content
            verbose("Content should be updated to " + newContent);
            var currentContent = kanban.getBoardsJSON();
            var remoteContent = newContent.content;

            if (Sortify(currentContent) !== Sortify(remoteContent)) {
                verbose("Content is different.. Applying content");
                kanban.options.boards = remoteContent;
                updateBoards(framework, kanban, remoteContent);
            }
        });

        framework.setContentGetter(function () {
            if (!kanban) {
                throw new Error("NOT INITIALIZED");
            }
            var content = kanban.getBoardsJSON();
            verbose("Content current value is " + content);
            return {
                content: content
            };
        });

        framework.onReady(function () {
            $("#cp-app-kanban-content").focus();
            var content = kanban.getBoardsJSON();
            cleanData(content);
        });

        framework.onDefaultContentNeeded(function () {
            kanban = initKanban(framework);
        });

        var myCursor = {};
        onCursorUpdate.reg(function (data) {
            myCursor = data;
            framework.updateCursor();
        });
        framework.onCursorUpdate(function (data) {
            if (!data) { return; }
            if (data.reset) {
                Object.keys(remoteCursors).forEach(function (id) {
                    if (remoteCursors[id].clear) {
                        remoteCursors[id].clear();
                    }
                    delete remoteCursors[id];
                });
                return;
            }

            var id = data.id;

            // Clear existing cursor
            Object.keys(remoteCursors).forEach(function (_id) {
                if (_id.indexOf(id) === 0 && remoteCursors[_id].clear) {
                    remoteCursors[_id].clear();
                    delete remoteCursors[_id];
                }
            });
            delete remoteCursors[id];

            var cursor = data.cursor;
            if (data.leave || !cursor) { return; }
            if (!cursor.item && !cursor.board) { return; }

            // Add new cursor
            var avatar = getAvatar(cursor);
            var $item = $('.kanban-item[data-eid="'+cursor.item+'"]');
            if ($item.length) {
                remoteCursors[id] = cursor;
                $item.find('.cp-kanban-cursors').append(avatar);
                return;
            }
            var $board = $('.kanban-board[data-id="'+cursor.board+'"]');
            if ($board.length) {
                remoteCursors[id] = cursor;
                $board.find('header .cp-kanban-cursors').append(avatar);
            }
        });
        framework.onCursorUpdate(function () {
            if (!editModal || !editModal.conflict) { return; }
            editModal.conflict.setValue();
        });
        framework.setCursorGetter(function () {
            return myCursor;
        });

        framework.start();

        // Collapse toolbar by default for cleaner view
        // Click the collapse button after a short delay to ensure toolbar is ready
        setTimeout(function () {
            var $collapseBtn = $('.cp-toolbar-collapse');
            if ($collapseBtn.length && !$('.cp-toolbar-top').hasClass('toolbar-hidden')) {
                $collapseBtn.click();
            }
        }, 100);
    };

    var main = function () {
        // var framework;
        nThen(function (waitFor) {

            // Framework initialization
            Framework.create({
                toolbarContainer: '#cme_toolbox',
                contentContainer: '#cp-app-kanban-editor',
                skipLink: '#cp-app-kanban-content'
            }, waitFor(function (framework) {
                andThen2(framework);
            }));
        });
    };
    main();
});
