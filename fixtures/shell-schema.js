/**
 * A2UI Self-Hosted Test App Shell Protocol Specification
 * The test App shell is 100% built using official A2UI components.
 * Aligned with the official README gallery visual style (#6a6eac).
 */

function createSelfHostedShellMessages(state = {}) {
  const {
    caseIndex = 2, // Default: 00_incremental.json
    totalCases = 43,
    caseName = 'Incremental',
    caseFile = '00_incremental.json',
    streamStatus = 'Ready',
    streamProgress = '6/6',
    nodeCount = 25,
    eventLogSummary = 'Waiting for component interaction. Click buttons in the card below to observe standard A2UI event loopback.',
  } = state;

  return [
    // 1. Initialize shell surface
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'a2ui-test-shell',
        catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
      },
    },
    // 2. Inject shell reactive data model
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: 'a2ui-test-shell',
        path: '/',
        value: {
          currentCaseTitle: `[${(caseIndex + 1).toString().padStart(2, '0')}/${totalCases}] ${caseName}`,
          currentCaseMeta: caseFile,
          streamStatus,
          streamProgress,
          nodeCount,
          eventLogSummary,
        },
      },
    },
    // 3. Build shell component tree (using official A2UI Basic Catalog components)
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 'a2ui-test-shell',
        components: [
          // Root container
          {
            id: 'root',
            component: 'Column',
            children: ['control_panel_card', 'event_monitor_card'],
          },

          // Control panel card (A2UI Card)
          {
            id: 'control_panel_card',
            component: 'Card',
            children: [
              'nav_row',
              'divider_1',
              'action_row',
              'divider_2',
              'status_row',
            ],
          },

          // First row: Case navigation (Row: Prev + Title/Meta + Next)
          {
            id: 'nav_row',
            component: 'Row',
            align: 'center',
            justify: 'spaceBetween',
            children: ['btn_prev', 'title_col', 'btn_next'],
          },
          {
            id: 'btn_prev',
            component: 'Button',
            variant: 'secondary',
            child: 'btn_prev_text',
            action: {
              event: {
                name: 'shell_nav_prev',
              },
            },
          },
          {
            id: 'btn_prev_text',
            component: 'Text',
            text: '‹ Prev',
          },
          {
            id: 'title_col',
            component: 'Column',
            align: 'center',
            children: ['title_text', 'meta_text'],
          },
          {
            id: 'title_text',
            component: 'Text',
            variant: 'title',
            text: { '@path': '/currentCaseTitle' },
          },
          {
            id: 'meta_text',
            component: 'Text',
            variant: 'caption',
            text: { '@path': '/currentCaseMeta' },
          },
          {
            id: 'btn_next',
            component: 'Button',
            variant: 'secondary',
            child: 'btn_next_text',
            action: {
              event: {
                name: 'shell_nav_next',
              },
            },
          },
          {
            id: 'btn_next_text',
            component: 'Text',
            text: 'Next ›',
          },

          {
            id: 'divider_1',
            component: 'Divider',
          },

          // Second row: Stream playback controls (Row: 4 compact buttons)
          {
            id: 'action_row',
            component: 'Row',
            align: 'center',
            justify: 'spaceBetween',
            children: ['btn_replay', 'btn_step', 'btn_direct', 'btn_picker'],
          },
          {
            id: 'btn_replay',
            component: 'Button',
            variant: 'primary',
            child: 'label_replay',
            action: {
              event: {
                name: 'shell_ctrl_replay',
              },
            },
          },
          {
            id: 'label_replay',
            component: 'Text',
            text: '🔄 Stream',
          },
          {
            id: 'btn_step',
            component: 'Button',
            variant: 'secondary',
            child: 'label_step',
            action: {
              event: {
                name: 'shell_ctrl_step',
              },
            },
          },
          {
            id: 'label_step',
            component: 'Text',
            text: '⏭ Step',
          },
          {
            id: 'btn_direct',
            component: 'Button',
            variant: 'secondary',
            child: 'label_direct',
            action: {
              event: {
                name: 'shell_ctrl_direct',
              },
            },
          },
          {
            id: 'label_direct',
            component: 'Text',
            text: '⚡ Direct',
          },
          {
            id: 'btn_picker',
            component: 'Button',
            variant: 'secondary',
            child: 'label_picker',
            action: {
              event: {
                name: 'shell_ctrl_picker',
              },
            },
          },
          {
            id: 'label_picker',
            component: 'Text',
            text: '⌕ Cases (43)',
          },

          {
            id: 'divider_2',
            component: 'Divider',
          },

          // Third row: Status and metrics
          {
            id: 'status_row',
            component: 'Row',
            align: 'center',
            justify: 'spaceBetween',
            children: ['status_text', 'nodes_text'],
          },
          {
            id: 'status_text',
            component: 'Text',
            variant: 'caption',
            text: {
              '@call': 'formatString',
              args: {
                value: '🟢 ${/streamStatus} · Chunk ${/streamProgress}',
              },
            },
          },
          {
            id: 'nodes_text',
            component: 'Text',
            variant: 'caption',
            text: {
              '@call': 'formatString',
              args: {
                value: 'Nodes: ${/nodeCount}',
              },
            },
          },

          // Event monitor card (A2UI Card)
          {
            id: 'event_monitor_card',
            component: 'Card',
            children: ['monitor_title', 'monitor_content'],
          },
          {
            id: 'monitor_title',
            component: 'Text',
            variant: 'label',
            text: 'A2UI Interaction Loopback (Renderer ➔ Self-Hosted Shell)',
          },
          {
            id: 'monitor_content',
            component: 'Text',
            variant: 'caption',
            text: { '@path': '/eventLogSummary' },
          },
        ],
      },
    },
  ];
}

module.exports = {
  createSelfHostedShellMessages,
};
