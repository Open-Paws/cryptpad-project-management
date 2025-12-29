// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

define([
    'jquery',
    '/customize/messages.js',
    '/common/common-util.js',
    '/common/visible.js',
    '/components/dragula/dist/dragula.min.js',
], function ($, Messages, Util, Visible, Dragula) {
        /**
         * jKanban
         * Vanilla Javascript plugin for manage kanban boards
         *
         * @site: http://www.riccardotartaglia.it/jkanban/
         * @author: Riccardo Tartaglia
         */
    return function () {
        var self = this;
        this.element = '';
        this.container = '';
        this.boardContainer = [];
        this.dragula = Dragula;
        this.drake = '';
        this.drakeBoard = '';
        this.addItemButton = false;
        this.cache = {};
        var defaults = {
            element: '',
            gutter: '15px',
            widthBoard: '250px',
            responsive: 0, //'700',
            responsivePercentage: false,
            boards: {
                data: {},
                items: {},
                list: []
            }, // The realtime kanban
            // _boards is a cloned, view-only copy of boards used ONLY for preserving scroll
            // positions and tracking which boards were previously displayed during redraws.
            // It stores only 'data' (board metadata) and 'list' (board ordering).
            // IMPORTANT: _boards must NEVER be used for reading or writing 'items' (tasks/cards).
            // All item operations must go through options.boards.items.
            _boards: {}, // The displayed kanban. We need to remember the old columns when we redraw
            getAvatar: function () {},
            openLink: function () {},
            getTags: function () {},
            getTextColor: function () { return '#000'; },
            cursors: {},
            tags: [],
            dragBoards: 'ontouchstart' in window ? false : true,
            addItemButton: false,
            readOnly: false,
            dragEl: function (/*el, source*/) {},
            dragendEl: function (/*el*/) {},
            dropEl: function (/*el, target, source, sibling*/) {},
            dragcancelEl: function (/*el, boardId*/) {},
            dragBoard: function (/*el, source*/) {},
            dragendBoard: function (/*el*/) {},
            dropBoard: function (/*el, target, source, sibling*/) {},
            click: function (/*el*/) {},
            boardTitleclick: function (/*el, boardId*/) {},
            addItemClick: function (/*el, boardId*/) {},
            renderMd: function (/*md*/) {},
            applyHtml: function (/*html, node*/) {},
            refresh: function () {},
            onChange: function () {}
        };

        var __extendDefaults = function (source, properties) {
            var property;
            for (property in properties) {
                if (properties.hasOwnProperty(property)) {
                    source[property] = properties[property];
                }
            }
            return source;
        };


        if (arguments[0] && typeof arguments[0] === "object") {
            this.options = __extendDefaults(defaults, arguments[0]);
        }

        var checkCache = function (boards) {
            Object.keys(self.cache).forEach(function (id) {
                if (boards.items[id]) { return; }
                delete self.cache[id];
            });
        };
        var removeUnusedTags = function (boards) {
            var tags = self.options.getTags(boards);
            var filter = self.options.tags || [];
            var toClean = [];
            filter.forEach(function (tag) {
                if (tags.indexOf(tag) === -1) { toClean.push(tag); }
            });
            toClean.forEach(function (t) {
                var idx = filter.indexOf(t);
                if (idx === -1) { return; }
                filter.splice(idx, 1);
            });
            // If all the tags have bene remove, make sure we show everything again
            if (!filter.length) {
                $('.kanban-item-hidden').removeClass('kanban-item-hidden');
            }
        };

        // Private functions

        function __setBoard() {
            self.element = document.querySelector(self.options.element);
            //create container
            var boardContainerOuter = document.createElement('div');
            boardContainerOuter.classList.add('kanban-container-outer');
            var boardContainer = document.createElement('div');
            boardContainer.setAttribute('id', 'kanban-container');
            boardContainer.classList.add('kanban-container');
            boardContainerOuter.appendChild(boardContainer);
            self.container = boardContainer;
            //add boards
            self.addBoards();
            var addBoard = document.createElement('div');
            addBoard.id = 'kanban-addboard';
            addBoard.innerHTML = '<i class="fa fa-plus"></i>';
            boardContainer.appendChild(addBoard);
            var trash = self.trashContainer = document.createElement('div');
            trash.setAttribute('id', 'kanban-trash');
            trash.setAttribute('class', 'kanban-trash');
            var trashBg = document.createElement('div');
            var trashIcon = document.createElement('i');
            trashIcon.setAttribute('class', 'fa fa-trash');
            trash.appendChild(trashIcon);
            trash.appendChild(trashBg);
            self.boardContainer.push(trash);

            //appends to container
            self.element.appendChild(boardContainerOuter);
            self.element.appendChild(trash);

            // send event that board has changed
            self.onChange();
        }

        function __onclickHandler(nodeItem) {
            nodeItem.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                self.options.click(this);
                if (typeof (this.clickfn) === 'function') {
                    this.clickfn(this);
                }
            });
        }

        function __onboardTitleClickHandler(nodeItem) {
            nodeItem.addEventListener('click', function (e) {
                e.preventDefault();
                self.options.boardTitleClick(this, e);
                if (typeof (this.clickfn) === 'function') {
                    this.clickfn(this);
                }
            });
        }

        function __onAddItemClickHandler(nodeItem) {
            function handleAddItem(e, item) {
                e.preventDefault();
                e.stopPropagation();
                self.options.addItemClick(item);
                if (typeof (item.clickfn) === 'function') {
                    item.clickfn(item);
                }
            }
            nodeItem.addEventListener('click', function (e) {
                handleAddItem(e,this);
            });
            nodeItem.addEventListener('keydown', function (e) {
                if (e.keyCode === 13) {
                    handleAddItem(e,this);
                }
            });
        }

        function __findBoardJSON(id) {
            return (self.options.boards.data || {})[id];
        }


        this.init = function () {
            // set initial boards
            __setBoard();

            // Scroll on drag
            var $el = $(self.element);
            var leftRegion = $el.position().left + 10;
            var rightRegion = $(window).width() - 10;
            var activeBoard;
            var $aB;
            var setActiveDrag = function (board) {
                activeBoard = undefined;
                if (!board) { return; }
                if (!board.classList.contains('kanban-drag')) { return; }
                activeBoard = board;
                $aB = $(activeBoard);
            };
            var mouseMoveState = false;
            var mouseDown = function () {
                mouseMoveState = true;
            };
            var mouseUp = function () {
                mouseMoveState = false;
            };
            var onMouseMove = function (isItem) {
                var to;
                var f = function (e) {
                    if (!mouseMoveState) { return; }
                    if (e.which !== 1) { return; } // left click
                    var distance = 20;
                    var moved = false;
                    // If this is an item drag, check scroll
                    if (isItem && activeBoard) {
                        var rect = activeBoard.getBoundingClientRect();
                        if (e.pageX > rect.left && e.pageX < rect.right) {
                            if (e.pageY < (rect.top + 20)) {
                                distance *= -1;
                                $aB.scrollTop(distance + $aB.scrollTop()) ;
                                moved = true;
                            } else if (e.pageY > (rect.bottom - 20)) {
                                $aB.scrollTop(distance + $aB.scrollTop()) ;
                                moved = true;
                            }
                        }
                    }
                    // Itme or board: horizontal scroll if needed
                    if (e.pageX < leftRegion) {
                        distance *= -1;
                        $el.scrollLeft(distance + $el.scrollLeft()) ;
                        moved = true;
                    } else if (e.pageX >= rightRegion) {
                        $el.scrollLeft(distance + $el.scrollLeft()) ;
                        moved = true;
                    }
                    if (!moved) { return; }
                    clearTimeout(to);
                    to = setTimeout(function () {
                        if (!mouseMoveState) { return; }
                        f(e);
                    }, 100);
                };
                return f;
            };

            //set drag with dragula
            if (window.innerWidth > self.options.responsive) {

                //Init Drag Board
                self.drakeBoard = self.dragula([self.container, self.trashContainer], {
                        moves: function (el, source, handle) {
                            if (self.options.readOnly) { return false; }
                            if (!self.options.dragBoards) { return false; }
                            return (handle.classList.contains('kanban-board-header') || handle.classList.contains('kanban-title-board'));
                        },
                        accepts: function (el, target, source, sibling) {
                            if (self.options.readOnly) { return false; }
                            if (sibling && sibling.getAttribute('id') === "kanban-addboard") { return false; }
                            return target.classList.contains('kanban-container') ||
                                   target.classList.contains('kanban-trash');
                        },
                        revertOnSpill: true,
                        direction: 'horizontal',
                    })
                    .on('drag', function (el, source) {
                        el.classList.add('is-moving');
                        self.options.dragBoard(el, source);
                        if (typeof (el.dragfn) === 'function') {
                            el.dragfn(el, source);
                        }
                        $('.kanban-trash').addClass('kanban-trash-suggest');
                        mouseDown();
                        $(document).on('mousemove', onMouseMove());
                    })
                    .on('dragend', function (el) {
                        el.classList.remove('is-moving');
                        self.options.dragendBoard(el);
                        mouseUp();
                        $(document).off('mousemove');
                        $('.kanban-trash').removeClass('kanban-trash-suggest');
                        if (typeof (el.dragendfn) === 'function') {
                            el.dragendfn(el);
                        }
                    })
                    .on('over', function (el, target) {
                        if (!target.classList.contains('kanban-trash')) { return false; }
                        $('.kanban-trash').addClass('kanban-trash-active');
                        $('.kanban-trash').removeClass('kanban-trash-suggest');
                    })
                    .on('out', function (el, target) {
                        if (!target.classList.contains('kanban-trash')) { return false; }
                        $('.kanban-trash').removeClass('kanban-trash-active');
                        $('.kanban-trash').addClass('kanban-trash-suggest');
                    })
                    .on('drop', function (el, target, source, sibling) {
                        el.classList.remove('is-moving');
                        self.options.dropBoard(el, target, source, sibling);
                        if (typeof (el.dropfn) === 'function') {
                            el.dropfn(el, target, source, sibling);
                        }

                        var id = Number($(el).attr('data-id'));
                        var list = self.options.boards.list || [];

                        var index1 = list.indexOf(id);
                        if (index1 === -1) { return; }

                        // Move to trash?
                        if (target.classList.contains('kanban-trash')) {
                            list.splice(index1, 1);
                            if (list.indexOf(id) === -1) {
                                delete self.options.boards.data[id];
                            }
                            self.onChange();
                            return;
                        }

                        var index2;
                        var id2 = Number($(sibling).attr("data-id"));
                        if (sibling && id2) {
                            index2 = list.indexOf(id2);
                        }
                        // If we can't find the drop position, drop at the end
                        if (typeof(index2) === "undefined" || index2 === -1) {
                            index2 = list.length;
                        }

                        console.log("Switch " + index1 + " and " + index2);
                        if (index1 < index2) {
                            index2 = index2 - 1;
                        }
                        list.splice(index1, 1);
                        list.splice(index2, 0, id);
                        // send event that board has changed
                        self.onChange();
                        self.setBoards(self.options.boards);
                    });

                //Init Drag Item
                self.drake = self.dragula(self.boardContainer, {
                    moves: function (el) {
                        if (self.options.readOnly) { return false; }
                        if (el.classList.contains('new-item')) { return false; }
                        if (self.options.dragItems === false) {return false;}
                        return el.classList.contains('kanban-item');
                    },
                    accepts: function () {
                        if (self.options.readOnly) { return false; }
                        return true;
                    },
                    revertOnSpill: true
                })
                    .on('cancel', function() {
                        self.enableAllBoards();
                    })
                    .on('drag', function (el, source) {
                        // we need to calculate the position before starting to drag
                        self.dragItemPos = self.findElementPosition(el);

                        setActiveDrag();
                        el.classList.add('is-moving');
                        mouseDown();
                        $(document).on('mousemove', onMouseMove(el));
                        $('.kanban-trash').addClass('kanban-trash-suggest');

                        self.options.dragEl(el, source);
                        if (el !== null && typeof (el.dragfn) === 'function') {
                            el.dragfn(el, source);
                        }
                    })
                    .on('dragend', function (el) {
                        console.log("In dragend");
                        el.classList.remove('is-moving');
                        self.options.dragendEl(el);
                        $('.kanban-trash').removeClass('kanban-trash-suggest');
                        mouseUp();
                        $(document).off('mousemove');
                        if (el !== null && typeof (el.dragendfn) === 'function') {
                            el.dragendfn(el);
                        }
                    })
                    .on('cancel', function (el, container, source) {
                        console.log("In cancel");
                        el.classList.remove('is-moving');
                        var boardId = $(source).closest('kanban-board').data('id');
                        self.options.dragcancelEl(el, boardId);
                    })
                    .on('over', function (el, target) {
                        setActiveDrag(target);
                        if (!target.classList.contains('kanban-trash')) { return false; }
                        target.classList.remove('kanban-trash-suggest');
                        target.classList.add('kanban-trash-active');

                    })
                    .on('out', function (el, target) {
                        setActiveDrag();
                        if (!target.classList.contains('kanban-trash')) { return false; }
                        target.classList.remove('kanban-trash-active');
                        target.classList.add('kanban-trash-suggest');

                    })
                    .on('drop', function(el, target, source, sibling) {
                        self.enableAllBoards();
                        el.classList.remove('is-moving');

                        console.log("In drop");

                        var id1 = Number($(el).attr('data-eid'));
                        var boardId = Number($(source).closest('.kanban-board').data('id'));

                        // Move to trash?
                        if (target.classList.contains('kanban-trash')) {
                            self.moveItem(boardId, id1);
                            self.onChange();
                            return;
                        }

                        // Find the new board
                        var targetId = Number($(target).closest('.kanban-board').data('id'));
                        if (!targetId) { return; }
                        var board2 = __findBoardJSON(targetId);
                        var id2 = $(sibling).attr('data-eid');
                        if (id2) { id2 = Number(id2); }
                        var pos2 = id2 ? board2.item.indexOf(id2) : board2.item.length;
                        if (pos2 === -1) { pos2 = board2.item.length; }

                        // Remove the "move" effect
                        if (el !== null) {
                            el.classList.remove('is-moving');
                        }

                        // Move the item
                        self.moveItem(boardId, id1, board2, pos2);

                        // send event that board has changed
                        self.onChange();
                        self.setBoards(self.options.boards);
                    });
            }
        };

        var findItem = function (eid) {
            var boards = self.options.boards;
            var list = boards.list || [];
            var res = [];
            list.forEach(function (id) {
                var b = boards.data[id];
                if (!b) { return; }
                var items = b.item || [];
                var idx = items.indexOf(eid);
                if (idx === -1) { return; }
                // This board contains our item...
                res.push({
                    board: b,
                    pos: idx
                });
            });
            return res;
        };
        this.checkItem = function (eid) {
            var boards = self.options.boards;
            var data = boards.data || {};
            var exists = Object.keys(data).some(function (id) {
                return (data[id].item || []).indexOf(Number(eid)) !== -1;
            });
            return exists;
        };
        // moveItem() is one of the ONLY supported paths for attaching/detaching items to/from
        // boards. It maintains sync between boards.items and each board.item array.
        // Along with addElement(), these functions ensure the activeItemIds invariant remains
        // correct: an item is "active" only if it appears in at least one board.item array.
        // WARNING: Any direct mutation of boards.data[*].item outside addElement() or moveItem()
        // is unsupported and may cause tasks or projects to be filtered out of My Tasks and
        // Timeline views. Contributors should always use these APIs for item attachment.
        this.moveItem = function (source, eid, board, pos) {
            var boards = self.options.boards;
            var same = -1;
            if (source && boards.data[source]) {
                // Defensive normalization: ensure source board.item exists and is an array
                if (!Array.isArray(boards.data[source].item)) {
                    boards.data[source].item = [];
                }
                // Remove from this board only
                var l = boards.data[source].item;
                var idx = l.indexOf(Number(eid));
                if (idx !== -1) { l.splice(idx, 1); }
                if (boards.data[source] === board) { same = idx; }
            } else {
                // Remove the item from all its board
                var from = findItem(eid);
                from.forEach(function (obj) {
                    // Defensive normalization
                    if (!Array.isArray(obj.board.item)) {
                        obj.board.item = [];
                        return;
                    }
                    obj.board.item.splice(obj.pos, 1);
                    if (obj.board === board) { same = obj.pos; }
                });
            }
            // If it's a deletion and not a duplicate, remove the item data
            if (!board) {
                if (!self.checkItem(eid)) {
                    delete boards.items[eid];
                    delete self.cache[eid];
                    removeUnusedTags(boards);
                    self.options.refresh();
                }
                return;
            }
            // Defensive normalization: ensure target board.item exists and is an array
            if (!Array.isArray(board.item)) {
                board.item = [];
            }
            // If the item already exists in the target board, abort (duplicate)
            if (board.item.indexOf(eid) !== -1) {
                return;
            }
            // If it's moved to the same board at a bigger index, decrement the index by one
            // (we just removed one element)
            if (same !== -1 && same < pos) {
                pos = pos - 1;
            }
            board.item.splice(pos, 0, eid);
        };

        this.enableAllBoards = function() {
            var allB = document.querySelectorAll('.kanban-board');
            if (allB.length > 0 && allB !== undefined) {
                for (var i = 0; i < allB.length; i++) {
                    allB[i].classList.remove('disabled-board');
                }
            }
        };

        var getElementNode = function (element) {
            var nodeItem = document.createElement('div');
            nodeItem.classList.add('kanban-item');
            nodeItem.dataset.eid = element.id;

            // Add completed class if project is marked complete
            if (element.completed) {
                nodeItem.classList.add('kanban-item-completed');
            }

            if (element.color) {
                if (/color/.test(element.color)) {
                    // Palette color
                    nodeItem.classList.add('cp-kanban-palette-'+element.color);
                } else {
                    // Hex color code
                    var textColor = self.options.getTextColor(element.color);
                    nodeItem.setAttribute('style', 'background-color:#'+element.color+';color:'+textColor+';');
                }
            }
            var nodeCursors = document.createElement('div');
            nodeCursors.classList.add('cp-kanban-cursors');
            Object.keys(self.options.cursors).forEach(function (id) {
                var c = self.options.cursors[id];
                if (Number(c.item) !== Number(element.id)) { return; }
                var el = self.options.getAvatar(c);
                nodeCursors.appendChild(el);
            });
            var nodeItemTextContainer = document.createElement('div');
            nodeItemTextContainer.classList.add('kanban-item-text-container');
            nodeItem.appendChild(nodeItemTextContainer);
            var nodeItemText  = document.createElement('div');
            nodeItemText.classList.add('kanban-item-text');
            nodeItemText.dataset.eid = element.id;
            nodeItemText.innerText = element.title;
            nodeItemTextContainer.appendChild(nodeItemText);
            
            // Check if this card is filtered out
            var hide = false;
            
            // Tags filter
            if (Array.isArray(self.options.tags) && self.options.tags.length) {
                if (self.options.tagsAnd) {
                    hide = !Array.isArray(element.tags) ||
                        !self.options.tags.every(function (tag) {
                          return element.tags.indexOf(tag) !== -1;
                    });
                } else {
                    hide = !Array.isArray(element.tags) ||
                        !element.tags.some(function (tag) {
                          return self.options.tags.indexOf(tag) !== -1;
                    });
                }
            }
            
            // Custom filter (for assignee, score, due date filters)
            if (!hide && self.options.customFilter && typeof self.options.customFilter === 'function') {
                hide = !self.options.customFilter(element);
            }

            // Hidden projects filter - only show to creator
            if (!hide && element.hidden) {
                var currentUser = '';
                if (typeof self.options.getCurrentUser === 'function') {
                    currentUser = self.options.getCurrentUser();
                }
                var itemCreator = (element.createdBy || '').toLowerCase();
                // Hide if current user is not the creator (and creator is set)
                if (itemCreator && itemCreator !== currentUser) {
                    hide = true;
                }
            }

            if (hide) {
                nodeItem.classList.add('kanban-item-hidden');
            }
            if (element.body) {
                var html;
                if (self.cache[element.id] && self.cache[element.id].body === element.body) {
                    html = self.cache[element.id].html;
                } else {
                    html = self.renderMd(element.body);
                    self.cache[element.id] = {
                        body: element.body,
                        html: html
                    };
                }
                var nodeBody = document.createElement('div');
                nodeBody.setAttribute('id', 'kanban-body-' + element.id);
                $(nodeBody).on('click', 'a', function (e) {
                    e.preventDefault();
                    var a = e.target;
                    if (!a.href) { return; }
                    var href = a.getAttribute('href');
                    self.options.openLink(href);
                });
                nodeBody.onclick = function (e) {
                    e.preventDefault();
                };
                //nodeBody.innerHTML = html;
                self.applyHtml(html, nodeBody);
                nodeBody.classList.add('kanban-item-body');
                nodeItem.appendChild(nodeBody);
            }
            if (Array.isArray(element.tags)) {
                var nodeTags = document.createElement('div');
                nodeTags.classList.add('kanban-item-tags');
                element.tags.forEach(function (_tag) {
                    var tag = document.createElement('span');
                    tag.innerText = _tag;
                    nodeTags.appendChild(tag);
                });
                nodeItem.appendChild(nodeTags);
            }
            
            // Add metrics display container with vertical stacked rows
            var metricsContainer = document.createElement('div');
            metricsContainer.classList.add('kanban-metrics-container');
            metricsContainer.dataset.eid = element.id;

            // Helper function to get color class based on score (0-10)
            var getScoreColorClass = function(score) {
                if (score <= 3) return 'kanban-metric-red';
                if (score <= 6) return 'kanban-metric-orange';
                if (score <= 8) return 'kanban-metric-yellow-green';
                return 'kanban-metric-green';
            };

            // Helper function to get color class based on percentage (0-100)
            var getTaskColorClass = function(percent) {
                if (percent <= 33) return 'kanban-metric-red';
                if (percent <= 66) return 'kanban-metric-orange';
                if (percent < 100) return 'kanban-metric-yellow-green';
                return 'kanban-metric-green';
            };

            // Calculate final score from scoring data
            var finalScore = 0;
            if (element.scoring) {
                var scoringDimensions = [
                    'scale_score', 'impact_magnitude_score', 'longevity_score',
                    'multiplication_score', 'foundation_score', 'agi_readiness_score',
                    'accessibility_score', 'coalition_building_score', 'pillar_coverage_score',
                    'build_feasibility_score'
                ];

                var total = 0;
                var count = 0;
                scoringDimensions.forEach(function(dim) {
                    if (element.scoring[dim] !== undefined && element.scoring[dim] > 0) {
                        total += element.scoring[dim];
                        count++;
                    }
                });

                if (count > 0) {
                    finalScore = Math.round((total / scoringDimensions.length) * 10) / 10;
                }
            }

            // ROW 1: Score row with full-width progress bar
            if (finalScore > 0) {
                var scoreRow = document.createElement('div');
                scoreRow.className = 'kanban-metric-row';
                scoreRow.setAttribute('title', 'Score: ' + finalScore + ' / 10');

                var scoreLabel = document.createElement('div');
                scoreLabel.className = 'kanban-metric-label';
                scoreLabel.innerHTML = '<i class="fa fa-star"></i> Score: ' + finalScore + '/10';
                scoreRow.appendChild(scoreLabel);

                var scoreBarBg = document.createElement('div');
                scoreBarBg.className = 'kanban-metric-bar-bg';

                var scoreBarFill = document.createElement('div');
                scoreBarFill.className = 'kanban-metric-bar-fill ' + getScoreColorClass(finalScore);
                scoreBarFill.style.width = (finalScore * 10) + '%';

                scoreBarBg.appendChild(scoreBarFill);
                scoreRow.appendChild(scoreBarBg);

                metricsContainer.appendChild(scoreRow);
            }

            // ROW 2: Tasks row with full-width progress bar
            if (Array.isArray(element.tasks) && element.tasks.length > 0) {
                var totalTasks = element.tasks.length;
                var doneTasks = element.tasks.filter(function(t) { return t.done; }).length;
                var taskPercent = Math.round((doneTasks / totalTasks) * 100);

                var taskRow = document.createElement('div');
                taskRow.className = 'kanban-metric-row';
                taskRow.setAttribute('title', doneTasks + ' of ' + totalTasks + ' tasks complete (' + taskPercent + '%)');

                var taskLabel = document.createElement('div');
                taskLabel.className = 'kanban-metric-label';
                taskLabel.innerHTML = '<i class="fa fa-check-square-o"></i> Tasks: ' + doneTasks + '/' + totalTasks + ' complete';
                taskRow.appendChild(taskLabel);

                var taskBarBg = document.createElement('div');
                taskBarBg.className = 'kanban-metric-bar-bg';

                var taskBarFill = document.createElement('div');
                taskBarFill.className = 'kanban-metric-bar-fill ' + getTaskColorClass(taskPercent);
                taskBarFill.style.width = taskPercent + '%';

                taskBarBg.appendChild(taskBarFill);
                taskRow.appendChild(taskBarBg);

                metricsContainer.appendChild(taskRow);
            }

            // ROW 3: Due date row with color-coded text (no bar)
            if (element.due_date) {
                var dateObj = new Date(element.due_date);
                if (!isNaN(dateObj.getTime())) {
                    var dueDateRow = document.createElement('div');
                    dueDateRow.className = 'kanban-metric-row kanban-due-date-row';

                    var exactDateStr = dateObj.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    dueDateRow.title = exactDateStr;

                    var now = new Date();
                    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    var dueDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
                    var daysUntilDue = Math.ceil((dueDay - today) / (1000 * 60 * 60 * 24));

                    var relativeText;
                    var dueDateClass = '';
                    if (daysUntilDue < 0) {
                        var daysOverdue = Math.abs(daysUntilDue);
                        if (daysOverdue === 1) {
                            relativeText = 'Overdue by 1 day';
                        } else if (daysOverdue < 7) {
                            relativeText = 'Overdue by ' + daysOverdue + ' days';
                        } else if (daysOverdue < 14) {
                            relativeText = 'Overdue by 1 week';
                        } else {
                            var weeksOverdue = Math.floor(daysOverdue / 7);
                            relativeText = 'Overdue by ' + weeksOverdue + ' weeks';
                        }
                        dueDateClass = 'kanban-due-text-overdue';
                    } else if (daysUntilDue === 0) {
                        relativeText = 'Due today';
                        dueDateClass = 'kanban-due-text-overdue';
                    } else if (daysUntilDue <= 7) {
                        if (daysUntilDue === 1) {
                            relativeText = 'Due tomorrow';
                        } else {
                            relativeText = 'Due in ' + daysUntilDue + ' days';
                        }
                        dueDateClass = 'kanban-due-text-urgent';
                    } else if (daysUntilDue <= 30) {
                        var weeks = Math.floor(daysUntilDue / 7);
                        relativeText = weeks === 1 ? 'Due in 1 week' : 'Due in ' + weeks + ' weeks';
                        dueDateClass = 'kanban-due-text-normal';
                    } else {
                        var months = Math.floor(daysUntilDue / 30);
                        relativeText = months === 1 ? 'Due in 1 month' : 'Due in ' + months + ' months';
                        dueDateClass = 'kanban-due-text-normal';
                    }

                    var dueDateLabel = document.createElement('div');
                    dueDateLabel.className = 'kanban-metric-label kanban-due-date-label ' + dueDateClass;
                    dueDateLabel.innerHTML = '<i class="fa fa-calendar"></i> ' + relativeText;
                    dueDateRow.appendChild(dueDateLabel);

                    metricsContainer.appendChild(dueDateRow);
                }
            }

            // Add completed badge if project is marked complete
            if (element.completed) {
                var completedRow = document.createElement('div');
                completedRow.className = 'kanban-metric-row';
                var completedBadge = document.createElement('div');
                completedBadge.className = 'kanban-completed-badge';
                completedBadge.innerHTML = '<i class="fa fa-check-circle"></i> Complete';
                completedBadge.setAttribute('title', 'This project is marked as complete');
                completedRow.appendChild(completedBadge);
                metricsContainer.appendChild(completedRow);
            }

            // Add assignees if present
            if (element.assignee && element.assignee.trim()) {
                var sanitizedAssignee = element.assignee.replace(/[<>"'&]/g, '');
                var assignees = sanitizedAssignee.split(',').map(function(a) { return a.trim(); }).filter(function(a) { return a; });
                if (assignees.length > 0) {
                    var assigneeRow = document.createElement('div');
                    assigneeRow.className = 'kanban-metric-row';
                    var assigneeText = assignees.length > 2 ? assignees[0] + ' +' + (assignees.length - 1) : assignees.join(', ');
                    var assigneeLabel = document.createElement('div');
                    assigneeLabel.className = 'kanban-metric-label kanban-assignee-label';
                    assigneeLabel.setAttribute('title', sanitizedAssignee);
                    assigneeLabel.innerHTML = '<i class="fa fa-user"></i> ' + assigneeText;
                    assigneeRow.appendChild(assigneeLabel);
                    metricsContainer.appendChild(assigneeRow);
                }
            }

            nodeItem.appendChild(metricsContainer);

            // Render task checklist on card face
            if (Array.isArray(element.tasks) && element.tasks.length > 0) {
                var taskListContainer = document.createElement('div');
                taskListContainer.className = 'kanban-card-tasks';

                // Get current user to filter hidden tasks
                var currentUser = '';
                if (typeof self.options.getCurrentUser === 'function') {
                    currentUser = self.options.getCurrentUser();
                }

                var visibleTasks = element.tasks.filter(function(task) {
                    // Show task if: not hidden, OR creator matches current user, OR no creator set (legacy)
                    if (!task.hidden) { return true; }
                    var taskCreator = (task.createdBy || '').toLowerCase();
                    return !taskCreator || taskCreator === currentUser;
                });

                visibleTasks.forEach(function(task, taskIndex) {
                    var taskItem = document.createElement('div');
                    taskItem.className = 'kanban-card-task-item';
                    if (task.done) {
                        taskItem.classList.add('kanban-card-task-done');
                    }
                    if (task.hidden) {
                        taskItem.classList.add('kanban-card-task-hidden');
                    }

                    var checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'kanban-card-task-checkbox';
                    checkbox.checked = !!task.done;
                    checkbox.setAttribute('data-task-index', taskIndex);

                    var taskTitle = document.createElement('span');
                    taskTitle.className = 'kanban-card-task-title';
                    taskTitle.textContent = task.title || 'Untitled task';

                    // Add hidden indicator icon if task is hidden
                    if (task.hidden) {
                        var hiddenIcon = document.createElement('i');
                        hiddenIcon.className = 'fa fa-eye-slash kanban-task-hidden-icon';
                        hiddenIcon.title = 'Hidden from others';
                        taskItem.appendChild(hiddenIcon);
                    }

                    taskItem.appendChild(checkbox);
                    taskItem.appendChild(taskTitle);

                    // Add due date badge if present
                    if (task.due_date) {
                        var dueDateBadge = document.createElement('span');
                        dueDateBadge.className = 'kanban-task-due-date';

                        // Calculate days until due
                        var today = new Date();
                        today.setHours(0, 0, 0, 0);
                        var dueDate = new Date(task.due_date);
                        dueDate.setHours(0, 0, 0, 0);
                        var daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

                        // Format exact date for tooltip
                        var exactDateStr = dueDate.toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                        dueDateBadge.title = exactDateStr;

                        // Calculate relative text based on days
                        var relativeText;
                        if (daysUntilDue < 0) {
                            // Overdue
                            var daysOverdue = Math.abs(daysUntilDue);
                            if (daysOverdue === 1) {
                                relativeText = 'Overdue by 1 day';
                            } else if (daysOverdue < 7) {
                                relativeText = 'Overdue by ' + daysOverdue + ' days';
                            } else if (daysOverdue < 14) {
                                relativeText = 'Overdue by 1 week';
                            } else {
                                var weeksOverdue = Math.floor(daysOverdue / 7);
                                relativeText = 'Overdue by ' + weeksOverdue + ' weeks';
                            }
                            dueDateBadge.classList.add('kanban-task-due-overdue');
                        } else if (daysUntilDue === 0) {
                            relativeText = 'Due today';
                            dueDateBadge.classList.add('kanban-task-due-overdue');
                        } else if (daysUntilDue === 1) {
                            relativeText = 'Due tomorrow';
                            dueDateBadge.classList.add('kanban-task-due-urgent');
                        } else if (daysUntilDue <= 6) {
                            relativeText = 'Due in ' + daysUntilDue + ' days';
                            dueDateBadge.classList.add('kanban-task-due-urgent');
                        } else if (daysUntilDue <= 13) {
                            relativeText = 'Due in 1 week';
                            dueDateBadge.classList.add('kanban-task-due-soon');
                        } else if (daysUntilDue <= 27) {
                            var weeks = Math.floor(daysUntilDue / 7);
                            relativeText = 'Due in ' + weeks + ' weeks';
                            dueDateBadge.classList.add('kanban-task-due-soon');
                        } else if (daysUntilDue <= 59) {
                            relativeText = 'Due in 1 month';
                            dueDateBadge.classList.add('kanban-task-due-later');
                        } else {
                            var months = Math.floor(daysUntilDue / 30);
                            relativeText = 'Due in ' + months + ' months';
                            dueDateBadge.classList.add('kanban-task-due-later');
                        }

                        dueDateBadge.textContent = relativeText;
                        taskItem.appendChild(dueDateBadge);
                    }

                    taskListContainer.appendChild(taskItem);
                });

                // Only append if there are visible tasks
                if (visibleTasks.length > 0) {
                    nodeItem.appendChild(taskListContainer);
                }
            }

            nodeItem.appendChild(nodeCursors);
            //add function
            nodeItem.clickfn = element.click;
            nodeItem.dragfn = element.drag;
            nodeItem.dragendfn = element.dragend;
            nodeItem.dropfn = element.drop;
            __onclickHandler(nodeItemText);
            return nodeItem;
        };

        // addElement() is one of the ONLY supported paths for attaching items to boards.
        // It maintains sync between boards.items and each board.item array.
        // Along with moveItem(), these functions ensure the activeItemIds invariant remains
        // correct: an item is "active" only if it appears in at least one board.item array.
        // WARNING: Any direct mutation of boards.data[*].item outside addElement() or moveItem()
        // is unsupported and may cause tasks or projects to be filtered out of My Tasks and
        // Timeline views. Contributors should always use these APIs for item attachment.
        this.addElement = function (boardID, element, before) {

            // add Element to JSON
            var boardJSON = __findBoardJSON(boardID);

            // Guard: if board not found, log warning and return early to prevent errors
            if (!boardJSON) {
                console.warn('[kanban addElement] Board ID ' + boardID + ' not found. Cannot add element.');
                return self;
            }

            // Defensive normalization: ensure board.item exists and is an array
            if (!Array.isArray(boardJSON.item)) {
                boardJSON.item = [];
            }

            // Check for duplicate: avoid adding the same item id multiple times
            if (boardJSON.item.indexOf(element.id) !== -1) {
                // This path intentionally updates only self.options.boards.items[element.id]
                // and does NOT re-render the DOM. For full re-render/re-sync, use setBoards().
                self.options.boards.items = self.options.boards.items || {};
                var existingItem = self.options.boards.items[element.id];
                // Warn if the new element differs from stored item (discourages using addElement for refresh)
                if (existingItem && JSON.stringify(existingItem) !== JSON.stringify(element)) {
                    console.warn('[kanban addElement] Element ' + element.id + ' already exists with different data. ' +
                        'addElement() updates data but does not re-render. Use setBoards() for full redraw.');
                }
                self.options.boards.items[element.id] = element;
                return self;
            }

            if (before) {
                boardJSON.item.unshift(element.id);
            } else {
                boardJSON.item.push(element.id);
            }
            self.options.boards.items = self.options.boards.items || {};
            self.options.boards.items[element.id] = element;

            var board = self.element.querySelector('[data-id="' + boardID + '"] .kanban-drag');
            if (before) {
                board.insertBefore(getElementNode(element), board.firstChild);
            } else {
                board.appendChild(getElementNode(element));
            }
            // send event that board has changed
            self.onChange();
            return self;
        };

        this.addForm = function (boardID, formItem, isTop) {
            var board = self.element.querySelector('[data-id="' + boardID + '"] .kanban-drag');
            if (isTop) {
                board.insertBefore(formItem, board.firstChild);
            } else {
                board.appendChild(formItem);
            }
            return self;
        };

        var getBoardNode = function (board) {
            var boards = self.options.boards;
            var boardWidth = self.options.widthBoard;
            //create node
            var boardNode = document.createElement('div');
            boardNode.dataset.id = board.id;
            boardNode.classList.add('kanban-board');
            var boardNodeInner = document.createElement('div');
            boardNodeInner.classList.add('kanban-board-inner');
            //set style
            if (self.options.responsivePercentage) {
                boardNode.style.width = boardWidth + '%';
            } else {
                boardNode.style.width = boardWidth;
            }
            boardNode.style.marginLeft = self.options.gutter;
            boardNode.style.marginRight = self.options.gutter;
            // header board
            var headerBoard = document.createElement('header');
            var allClasses = [];
            if (board.class !== '' && board.class !== undefined) {
                allClasses = board.class.split(",");
            }
            headerBoard.classList.add('kanban-board-header');
            allClasses.map(function (value) {
                headerBoard.classList.add(value);
            });
            if (board.color !== '' && board.color !== undefined) {
                if (/color/.test(board.color)) {
                    // Palette color
                    headerBoard.classList.add('cp-kanban-palette-'+board.color);
                    boardNodeInner.classList.add('cp-kanban-palette-'+board.color);
                } else if (!/^[0-9a-f]{6}$/.test(board.color)) {
                    // "string" color (red, blue, etc.)
                    headerBoard.classList.add("kanban-header-" + board.color);
                } else {
                    // Hex color code
                    var textColor = self.options.getTextColor(board.color);
                    headerBoard.setAttribute('style', 'background-color:#'+board.color+';color:'+textColor+';');
                }
            }

            // Create header content wrapper
            var headerContent = document.createElement('div');
            headerContent.classList.add('kanban-header-content');
            
            // Colored dot indicator (glowing ball)
            var dotIndicator = document.createElement('div');
            dotIndicator.classList.add('kanban-header-dot');
            dotIndicator.setAttribute('data-board-id', board.id);
            
            // Set color based on board color or default
            // Default colors based on typical Kanban column names
            var defaultColors = {
                'in progress': '#3B82F6', // Blue
                'to do': '#F59E0B',       // Orange/Amber
                'todo': '#F59E0B',
                'done': '#10B981',        // Green
                'completed': '#10B981',
                'backlog': '#8B5CF6'      // Purple
            };
            
            var dotColor = '#3B82F6'; // Fallback blue
            var boardTitle = (board.title || '').toLowerCase();
            
            if (board.color) {
                if (/color/.test(board.color)) {
                    // Use palette color - will be styled via CSS
                    dotIndicator.classList.add('cp-kanban-dot-color-' + board.color);
                    // Set color for inline style too
                    if (board.color === 'color0') dotColor = '#3B82F6';
                    else if (board.color === 'color1') dotColor = '#F59E0B';
                    else if (board.color === 'color2') dotColor = '#10B981';
                    else if (board.color === 'color3') dotColor = '#EF4444';
                    else if (board.color === 'color4') dotColor = '#8B5CF6';
                } else if (board.color === 'blue' || board.color === '0AC') {
                    dotColor = '#3B82F6';
                } else if (board.color === 'orange' || board.color === 'F91') {
                    dotColor = '#F59E0B';
                } else if (board.color === 'green' || board.color === '8C4') {
                    dotColor = '#10B981';
                } else if (/^[0-9a-f]{6}$/i.test(board.color)) {
                    dotColor = '#' + board.color;
                }
            } else {
                // No color set, use default based on title
                for (var key in defaultColors) {
                    if (boardTitle.indexOf(key) !== -1) {
                        dotColor = defaultColors[key];
                        break;
                    }
                }
            }
            
            dotIndicator.style.backgroundColor = dotColor;
            dotIndicator.style.color = dotColor; // For box-shadow currentColor glow effect
            headerContent.appendChild(dotIndicator);

            var titleBoard = document.createElement('div');
            titleBoard.classList.add('kanban-title-board');

            // Parse title to separate short name from description
            // Format: "Short Name (Description text here)" or just "Short Name"
            var fullTitle = board.title || '';
            var shortName = fullTitle;
            var description = '';
            var parenMatch = fullTitle.match(/^([^(]+)\s*\((.+)\)\s*$/);
            if (parenMatch) {
                shortName = parenMatch[1].trim();
                description = parenMatch[2].trim();
            }

            titleBoard.innerText = shortName;
            if (description) {
                titleBoard.setAttribute('title', description);
            }

            titleBoard.clickfn = board.boardTitleClick;
            __onboardTitleClickHandler(titleBoard);
            headerContent.appendChild(titleBoard);

            // Count badge showing number of items
            var countBadge = document.createElement('div');
            countBadge.classList.add('kanban-header-count');
            var itemCount = (board.item || []).length;
            countBadge.innerText = itemCount;
            headerContent.appendChild(countBadge);

            // Action buttons container
            var actionButtons = document.createElement('div');
            actionButtons.classList.add('kanban-header-actions');

            // Plus button
            var plusButton = document.createElement('button');
            plusButton.classList.add('kanban-header-action-btn', 'kanban-header-plus');
            plusButton.setAttribute('title', 'Add item');
            plusButton.setAttribute('aria-label', 'Add item');
            var plusIcon = document.createElement('i');
            plusIcon.className = 'fa fa-plus';
            plusButton.appendChild(plusIcon);
            // Add click handler for adding items - will be connected by framework
            plusButton.dataset.boardId = board.id;
            actionButtons.appendChild(plusButton);

            // Ellipsis button removed as per user request - edit functionality moved to other UI elements

            headerContent.appendChild(actionButtons);
            headerBoard.appendChild(headerContent);

            var nodeCursors = document.createElement('div');
            nodeCursors.classList.add('cp-kanban-cursors');
            Object.keys(self.options.cursors).forEach(function (id) {
                var c = self.options.cursors[id];
                if (Number(c.board) !== Number(board.id)) { return; }
                var el = self.options.getAvatar(c);
                nodeCursors.appendChild(el);
            });
            headerBoard.appendChild(nodeCursors);

            //content board
            var contentBoard = document.createElement('main');
            contentBoard.classList.add('kanban-drag');
            contentBoard.setAttribute('tabindex', '-1');
            //add drag to array for dragula
            self.boardContainer.push(contentBoard);
            // Sort items if custom sort function is provided
            var itemsToRender = (board.item || []).slice(); // Create a copy
            if (self.options.customSort && typeof self.options.customSort === 'function') {
                var itemObjects = itemsToRender.map(function(itemkey) {
                    return { key: itemkey, item: boards.items[itemkey] };
                }).filter(function(obj) {
                    return obj.item; // Filter out missing items
                });
                
                itemObjects.sort(function(a, b) {
                    return self.options.customSort(a.item, b.item);
                });
                
                itemsToRender = itemObjects.map(function(obj) { return obj.key; });
            }
            
            itemsToRender.forEach(function (itemkey) {
                //create item
                var itemKanban = boards.items[itemkey];
                if (!itemKanban) {
                    var idx = board.item.indexOf(itemkey);
                    if (idx > -1) { board.item.splice(idx, 1); }
                    return;
                }
                var nodeItem = getElementNode(itemKanban);
                contentBoard.appendChild(nodeItem);
            });

            //footer board
            var footerBoard = document.createElement('footer');
            footerBoard.classList.add('kanban-board-footer');
            //add button - single clear button to add project
            var addProjectBtn = document.createElement('button');
            addProjectBtn.classList.add('kanban-add-project-btn');
            $(addProjectBtn).attr('tabindex', '0');
            $(addProjectBtn).attr('aria-label', Messages.addItem || 'Add project');
            $(addProjectBtn).attr('title', Messages.addItem || 'Add project');
            addProjectBtn.innerHTML = '<i class="fa fa-plus"></i> Add Project';
            footerBoard.appendChild(addProjectBtn);
            __onAddItemClickHandler(addProjectBtn);

            //board assembly
            boardNode.appendChild(boardNodeInner);
            boardNodeInner.appendChild(headerBoard);
            boardNodeInner.appendChild(contentBoard);
            boardNodeInner.appendChild(footerBoard);

            return boardNode;
        };

        let reorder = () => {
            // Push "add" button to the end of the list
            let add = document.getElementById('kanban-addboard');
            let list = document.getElementById('kanban-container');
            if (!add || !list) { return; }
            list.appendChild(add);
        };

        this.addBoard = function (board) {
            if (!board || !board.id) { return; }
            // Board objects are written BY REFERENCE into both options.boards.data and
            // options._boards.data. This makes incremental local changes immediately visible
            // in both structures without needing a full clone. Any full content refresh
            // (e.g., from remote updates) will later replace _boards entirely via setBoards().
            // Note: We only sync 'data' and 'list' to _boards; items are never stored there.
            var boards = self.options.boards;
            boards.data = boards.data || {};
            boards.list = boards.list || [];
            var _boards = self.options._boards;
            _boards.data = _boards.data || {};
            _boards.list = _boards.list || [];
            // If it already there, abort
            // Write by reference to both structures for immediate local visibility
            boards.data[board.id] = board;
            _boards.data[board.id] = board;
            if (boards.list.indexOf(board.id) !== -1) { return; }

            boards.list.push(board.id);
            _boards.list.push(board.id);
            var boardNode = getBoardNode(board);
            self.container.appendChild(boardNode);
            reorder();
        };

        this.addBoards = function() {
            // Sanity check: this function should only use _boards.data and _boards.list
            // for determining which boards to render. It must NOT read _boards.items.
            // Item data is always fetched from self.options.boards.items via getBoardNode().
            // If you need item data, use self.options.boards.items instead.

            //for on all the boards
            var boards = self.options._boards;
            boards.list = boards.list || [];
            boards.data = boards.data || {};
            var toRemove = [];
            boards.list.forEach(function (boardkey) {
                // single board
                var board = boards.data[boardkey];
                if (!board) {
                    toRemove.push(boardkey);
                    return;
                }

                var boardNode = getBoardNode(board);

                //board add
                self.container.appendChild(boardNode);
            });
            toRemove.forEach(function (id) {
                var idx = boards.list.indexOf(id);
                if (idx > -1) { boards.list.splice(idx, 1); }
            });

            // send event that board has changed
            self.onChange();

            return self;
        };

        var onVisibleHandler = false;
        // setBoards() is the CANONICAL path for re-synchronizing _boards with the
        // authoritative boards structure. It performs a full clone and redraw.
        // All remote updates and full refreshes should flow through this function.
        // For incremental local changes, addBoard() writes by reference to both structures.
        this.setBoards = function (boards) {
            var scroll = {};
            // Fix the tags
            checkCache(boards);
            removeUnusedTags(boards);
            // Get horizontal scroll
            var $el = $(self.element);
            var scrollLeft = $el.scrollLeft();
            // Get existing boards list
            var list = Util.clone(this.options._boards.list);

            // Diagnostic check: verify each boardkey in the old list exists in the new boards.data
            // This helps detect list/data divergence due to remote or migration bugs.
            list.forEach(function (boardkey) {
                if (!boards.data || !boards.data[boardkey]) {
                    console.warn('[kanban setBoards] Board ID ' + boardkey + ' in _boards.list has no corresponding entry in boards.data');
                }
            });

            // Update memory
            this.options.boards = boards;
            // Clone boards into _boards for scroll preservation and redraw tracking.
            // _boards is a view-only copy: only 'data' and 'list' should be read from it.
            // Items must always be read from options.boards.items, never from _boards.
            this.options._boards = Util.clone(boards);

            // If the tab is not focused but a handler already exists: abort
            if (!Visible.currently() && onVisibleHandler) { return; }

            var todoOnVisible = function () {
                // Remove all boards
                for (var i in list) {
                    var boardkey = list[i];
                    scroll[boardkey] = $('.kanban-board[data-id="'+boardkey+'"] .kanban-drag').scrollTop();
                    self.removeBoard(boardkey);
                }

                // Add all new boards
                self.addBoards();
                self.options.refresh();
                // Preserve scroll
                self.options._boards.list.forEach(function (id) {
                    if (!scroll[id]) { return; }
                    var $boardDrag = $('.kanban-board[data-id="'+id+'"] .kanban-drag');
                    if (!$boardDrag.length) {
                        console.warn('[kanban setBoards] Scroll restoration: no DOM element found for board ID ' + id);
                        return;
                    }
                    $boardDrag.scrollTop(scroll[id]);
                });
                $el.scrollLeft(scrollLeft);
                reorder();
            };

            // If the tab is not focused, redraw on focus
            if (!Visible.currently()) {
                onVisibleHandler = true;
                return void Visible.onChange(function (visible) {
                    if (!visible) { return; }
                    todoOnVisible();
                    onVisibleHandler = false;
                }, true);
            }
            todoOnVisible();
        };

        this.findBoard = function (id) {
            var el = self.element.querySelector('[data-id="' + id + '"]');
            return el;
        };

        this.findElement = function (id) {
            var el = self.element.querySelector('[data-eid="' + id + '"]');
            return el;
        };

        this.findElementPosition = function (el) {
            // we are looking at the element position in the child array
            return $(el.parentNode.children).index(el);
        };

        this.getBoardElements = function (id) {
            var board = self.element.querySelector('[data-id="' + id + '"] .kanban-drag');
            return (board.childNodes);
        };

        this.removeElement = function (el) {
            if (typeof (el) === 'string') {
                el = self.element.querySelector('[data-eid="' + el + '"]');
            }
            el.remove();

            // send event that board has changed
            self.onChange();

            return self;
        };

        this.removeBoard = function (board) {
            var id;
            if (typeof (board) === 'string' || typeof (board) === "number") {
                id = board;
                board = self.element.querySelector('[data-id="' + board + '"]');
            } else if (board) {
                id = board.id;
            }
            if (board) {
                board.remove();

                // send event that board has changed
                self.onChange();
            }

            // Remove duplicates
            if (id) { $(self.element).find('.kanban-board[data-id="' + board + '"]').remove(); }

            return self;
        };

        this.applyHtml = function (html, node) {
            return self.options.applyHtml(html, node);
        };
        this.renderMd = function (md) {
            return self.options.renderMd(md);
        };
        this.onChange = function () {
            self.options.onChange();
        };

        this.getBoardsJSON = function () {
            return self.options.boards;
        };

        this.getBoardJSON = function (id) {
            return __findBoardJSON(id);
        };
        this.getItemJSON = function (id) {
            return (self.options.boards.items || {})[id];
        };


        //init plugin
        this.init();
    };
});
