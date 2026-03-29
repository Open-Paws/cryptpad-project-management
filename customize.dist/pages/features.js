// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

define([
    'jquery',
    '/common/hyperscript.js',
    '/customize/messages.js',
    '/customize/application_config.js',
    '/common/outer/local-store.js',
    '/customize/pages.js',
    '/api/config',
    '/common/common-ui-elements.js',
    '/common/common-constants.js',
    '/common/pad-types.js',
    '/common/extensions.js'
], function ($, h, Msg, AppConfig, LocalStore, Pages, Config, UIElements, Constants, PadTypes, Extensions) {
    return function () {
        document.title = Msg.features;
        Msg.features_f_apps_note = PadTypes.availableTypes.map(function (app) {
            if (AppConfig.registeredOnlyTypes.indexOf(app) !== -1) { return; }
            if (AppConfig.premiumTypes && AppConfig.premiumTypes.includes(app)) { return; }
            if (Constants.earlyAccessApps && Constants.earlyAccessApps.includes(app) &&
                  AppConfig.enableEarlyAccess) { return; }
            return Msg.type[app];
        }).filter(function (x) { return x; }).join(', ');

        var groupItemTemplate = function (title, content) {
            return h('li.list-group-item', [
                h('div.cp-check'),
                h('div.cp-content', [
                    h('div.cp-feature', title),
                    h('div.cp-note', content),
                ])
            ]);
        };

        var defaultGroupItem = function (key) {
            return groupItemTemplate(
                Msg['features_f_' + key],
                Msg['features_f_' + key + '_note']
            );
        };

        var SPECIAL_GROUP_ITEMS = {};
        SPECIAL_GROUP_ITEMS.storage0 = function (f) {
            return groupItemTemplate(
                Msg['features_f_' + f],
                Msg._getKey('features_f_' + f + '_note', [Config.inactiveTime])
            );
        };
        SPECIAL_GROUP_ITEMS.file1 = function (f) {
            return groupItemTemplate(
                Msg['features_f_' + f],
                Msg._getKey('features_f_' + f + '_note', [Config.maxUploadSize / 1024 / 1024])
            );
        };
        SPECIAL_GROUP_ITEMS.storage1 = function (f) {
            return groupItemTemplate(
                Msg._getKey('features_f_' + f, [UIElements.prettySize(Config.defaultStorageLimit)]),
                Msg['features_f_' + f + '_note']
            );
        };
        SPECIAL_GROUP_ITEMS.storage2 = function (f) {
            return groupItemTemplate(
                Msg['features_f_' + f],
                Msg._getKey('features_f_' + f + '_note', [Config.premiumUploadSize / 1024 / 1024])
            );
        };

        var groupItem = function (key) {
            return (SPECIAL_GROUP_ITEMS[key] || defaultGroupItem)(key);
        };

        // ── CryptPaws-specific feature sections ───────────────────────────────

        var featureCard = function (icon, title, body) {
            return h('div.col-12.col-md-6.col-lg-4.cp-feature-card-wrap', [
                h('div.card.cp-unique-card', [
                    h('div.card-body', [
                        h('div.cp-unique-icon', [h('i.fa.' + icon)]),
                        h('h3', title),
                        h('p', body),
                    ])
                ])
            ]);
        };

        var uniqueSection = h('div.row.cp-page-section.cp-unique-section', [
            h('div.col-12', [
                h('h2', 'Built for animal liberation'),
                h('p.cp-unique-lead', [
                    'CryptPaws is a fork of ',
                    h('a', { href: 'https://cryptpad.org', target: '_blank', rel: 'noopener noreferrer' }, 'CryptPad'),
                    ' purpose-built for the animal liberation movement. Every document is end-to-end encrypted in your browser — the server never sees your content, making it safe for sensitive investigation data, coalition planning, and activist communications.'
                ]),
            ]),
            featureCard('fa-lock', 'Zero-knowledge encryption',
                'All documents are encrypted before leaving your device. No one — not the server, not administrators, not law enforcement with a subpoena — can read your files without your key.'),
            featureCard('fa-tasks', 'Campaign project management',
                'A full project management suite built into the Kanban board: Timeline/Gantt view, task dependencies, recurring tasks, assignee tracking, start and due dates, and tags.'),
            featureCard('fa-bar-chart', 'Impact scoring & analytics',
                'A 10-dimension impact scoring system designed for advocacy work — measuring scale, longevity, coalition building, coverage across approaches, and feasibility. Surfaces your highest-leverage projects automatically.'),
            featureCard('fa-tachometer', 'Live dashboard',
                'See everything at a glance: tasks due today, overdue items, blocked tasks, workload by person, and score distribution across all your projects — updated in real time.'),
            featureCard('fa-users', 'Coalition coordination',
                'Real-time collaboration across organizations with fine-grained access controls. Share documents securely. No personal information required to get started.'),
            featureCard('fa-code-fork', 'Open source & self-hostable',
                'Fully open source. Any organization can run their own instance with complete data sovereignty — no dependency on corporate infrastructure or third-party services.'),
        ]);

        var pmSection = h('div.row.cp-page-section.cp-pm-section', [
            h('div.col-12', [
                h('h2', 'Project management suite'),
                h('p.cp-unique-lead', 'The CryptPaws Kanban board goes far beyond sticky notes. It\'s a complete campaign coordination platform, encrypted end-to-end.'),
            ]),
            h('div.col-12', [
                h('div.row', [
                    h('div.col-12.col-md-6', [
                        h('ul.cp-pm-list', [
                            h('li', [h('strong', 'Four views: '), 'Board, Timeline/Gantt, My Tasks, and Analytics Dashboard']),
                            h('li', [h('strong', 'Task dependencies: '), 'Block tasks on prerequisites; see what\'s blocked at a glance']),
                            h('li', [h('strong', 'Recurring tasks: '), 'Daily, weekly, or monthly recurrence with automatic next-instance generation']),
                            h('li', [h('strong', 'Assignee management: '), 'Assign tasks to team members; track workload and completion rates per person']),
                            h('li', [h('strong', 'Start and due dates: '), 'Full scheduling with timeline visualization and overdue tracking']),
                        ])
                    ]),
                    h('div.col-12.col-md-6', [
                        h('ul.cp-pm-list', [
                            h('li', [h('strong', '10-dimension impact scoring: '), 'Scale, magnitude, longevity, multiplication, foundation, future-readiness, accessibility, coalition building, coverage, feasibility']),
                            h('li', [h('strong', 'Smart filters: '), 'Filter by assignee, status, due date, or score range across all views simultaneously']),
                            h('li', [h('strong', 'Tags and color coding: '), 'Visual organization with project colors and flexible tagging']),
                            h('li', [h('strong', 'Quick stats: '), 'Due today, this week, next 30 days, overdue, blocked, high-impact — always visible']),
                        ])
                    ]),
                ])
            ])
        ]);

        // ── Standard tier comparison ──────────────────────────────────────────

        var anonymousFeatures =
            h('div.col-12.col-sm-4.cp-anon-user',[
                h('div.card',[
                    h('div.title-card',[
                        h('h3.text-center',Msg.features_anon)
                    ]),
                    h('div.card-body.cp-pricing',[
                        h('div.text-center', '0€'),
                        h('div.text-center', Msg.features_noData),
                    ]),
                    h('ul.list-group.list-group-flush', [
                        'apps',
                        'file0',
                        'core',
                        'cryptdrive0',
                        'storage0'
                    ].map(groupItem)),
                ]),
            ]);

        var registeredFeatures =
            h('div.col-12.col-sm-4.cp-regis-user',[
                h('div.card',[
                    h('div.title-card',[
                        h('h3.text-center',Msg.features_registered)
                    ]),
                    h('div.card-body.cp-pricing',[
                        h('div.text-center', '0€'),
                        h('div.text-center', Msg.features_noData),
                    ]),
                    h('ul.list-group.list-group-flush', [
                        'anon',
                        'social',
                        'file1',
                        'cryptdrive1',
                        'devices',
                        'storage1'
                    ].map(groupItem)),
                    h('div.card-body',[
                        h('div.cp-features-register#cp-features-register', [
                            h('a', {
                                href: '/register/',
                                class: 'cp-features-register-button',
                            }, Msg.features_f_register)
                        ]),
                    ]),
                ]),
            ]);

        var availableFeatures = [
            anonymousFeatures,
            registeredFeatures,
        ];

        Extensions.getExtensionsSync('EXTRA_PRICING').forEach(ext => {
            if (!ext.getContent) { return; }
            availableFeatures.push(ext.getContent(groupItem));
        });

        return h('div#cp-main', [
            Pages.infopageTopbar(),
            h('div.container.cp-container',[
                h('div.row.cp-page-title',[
                    h('div.col-12.text-center', h('h1', Msg.features_title)),
                ]),
                uniqueSection,
                pmSection,
                h('h2.cp-features-tier-heading', 'Account tiers'),
                h('div.row.cp-container.cp-features-web.justify-content-sm-center', availableFeatures),
            ]),
            Pages.infopageFooter()
        ]);
    };
});
