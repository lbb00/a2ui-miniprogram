/**
 * A2UI Self-Hosted Test App Shell 协议规范
 * 整个测试 App 外壳 100% 完全基于 A2UI 官方组件体系构建（彻底丢掉对话流，纯粹自举）
 * 对齐官方 README 画廊 #6a6eac 经典视觉风格
 */

function createSelfHostedShellMessages(state = {}) {
  const {
    caseIndex = 2, // 默认 00_incremental.json
    totalCases = 43,
    caseName = 'Incremental',
    caseFile = '00_incremental.json',
    streamStatus = '已就绪',
    streamProgress = '6/6',
    nodeCount = 25,
    eventLogSummary = '等待组件交互。请点击下方卡片中的按钮（如 "Book now"），观察标准 A2UI 事件向外壳的回传闭环。',
  } = state;

  return [
    // 1. 初始化外壳画布
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'a2ui-test-shell',
        catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
      },
    },
    // 2. 注入外壳响应式数据模型
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
    // 3. 构建外壳组件树 (全部采用 A2UI Basic Catalog 官方组件)
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 'a2ui-test-shell',
        components: [
          // 根容器
          {
            id: 'root',
            component: 'Column',
            children: ['control_panel_card', 'event_monitor_card'],
          },

          // 核心控制卡片 (A2UI Card)
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

          // 第一行：用例切换行 (Row: Prev + Title/Meta + Next)
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
            text: '‹ 上一个',
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
            text: '下一个 ›',
          },

          {
            id: 'divider_1',
            component: 'Divider',
          },

          // 第二行：流式播放控制器 (Row: 4个紧凑功能按钮)
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
            text: '🔄 流式拼装',
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
            text: '⏭ 步进',
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
            text: '⚡ 直达',
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
            text: '⌕ 选集 (43)',
          },

          {
            id: 'divider_2',
            component: 'Divider',
          },

          // 第三行：状态与节点指标行
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
                value: '🟢 ${/streamStatus} · 帧 ${/streamProgress}',
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
                value: '已装配节点: ${/nodeCount}',
              },
            },
          },

          // 事件闭环监控卡片 (A2UI Card)
          {
            id: 'event_monitor_card',
            component: 'Card',
            children: ['monitor_title', 'monitor_content'],
          },
          {
            id: 'monitor_title',
            component: 'Text',
            variant: 'label',
            text: 'A2UI 双向交互闭环 (Renderer ➔ Self-Hosted Shell)',
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
