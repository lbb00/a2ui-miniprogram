/**
 * A2UI 官方 Agent 交互场景预设库
 * 将 43 组官方用例与真实的 Agent Prompt 意图完美关联，还原官方 Demo 真实交互体验
 */

const ALL_CASES = require('./official-all-cases');

const AGENT_SCENARIOS = [
  {
    prompt: '推荐 4 家纽约高分特色餐厅并支持即时预订',
    caseFile: '00_incremental.json',
    title: '餐厅探索与预订',
    category: '生活服务',
  },
  {
    prompt: '查询北京首都(PEK)飞往上海虹桥(SHA)的航班实时动态',
    caseFile: '01_flight-status.json',
    title: '实时航班动态',
    category: '出行交通',
  },
  {
    prompt: '查看索尼降噪无线耳机详情与买家真实评价',
    caseFile: '05_product-card.json',
    title: '电商商品卡片',
    category: '电商购物',
  },
  {
    prompt: '查看地中海藜麦沙拉(Quinoa Bowl)的配方与制作步骤',
    caseFile: '24_recipe-card.json',
    title: '美食菜谱指南',
    category: '健康美食',
  },
  {
    prompt: '帮我草拟一份关于项目季度复盘的邮件',
    caseFile: '02_email-compose.json',
    title: '邮件草稿撰写',
    category: '办公协作',
  },
  {
    prompt: '显示我的今日日程安排与会议提醒',
    caseFile: '03_calendar-day.json',
    title: '个人日历日程',
    category: '时间管理',
  },
  {
    prompt: '查看当前全球主要金融资产走势与收益网格',
    caseFile: '33_financial-data-grid.json',
    title: '金融资产数据网格',
    category: '金融理财',
  },
];

module.exports = {
  AGENT_SCENARIOS,
  ALL_CASES,
};
