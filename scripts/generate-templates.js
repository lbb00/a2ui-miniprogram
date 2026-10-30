const fs = require('fs');
const path = require('path');

function generateTemplate(level, maxLevel = 4) {
  const isLeaf = level >= maxLevel;
  const next = level + 1;
  const childInvocation = isLeaf
    ? `<a2ui-surface-layer node="{{item}}" surfaceId="{{surfaceId}}" uiState="{{uiState}}" />`
    : `<template is="tmpl_${next}_node" data="{{ i: item, surfaceId, uiState }}" />`;

  const triggerInvocation = isLeaf
    ? `<a2ui-surface-layer node="{{i.triggerNode || (!i.contentNode && i.children && i.children[0])}}" surfaceId="{{surfaceId}}" uiState="{{uiState}}" />`
    : `<template is="tmpl_${next}_node" data="{{ i: i.triggerNode || (!i.contentNode && i.children && i.children[0]), surfaceId, uiState }}" />`;

  const contentInvocation = isLeaf
    ? `<a2ui-surface-layer node="{{i.contentNode || (i.children && (i.triggerNode ? i.children[1] : (i.children[1] || i.children[0])))}}" surfaceId="{{surfaceId}}" uiState="{{uiState}}" />`
    : `<template is="tmpl_${next}_node" data="{{ i: i.contentNode || (i.children && (i.triggerNode ? i.children[1] : (i.children[1] || i.children[0]))), surfaceId, uiState }}" />`;

  return `<!-- ==================== LEVEL ${level} Template ==================== -->
<template name="tmpl_${level}_node">
  <!-- 1. Column -->
  <view wx:if="{{i.component === 'Column'}}" class="a2ui-column a2ui-align-{{i.align}} a2ui-justify-{{i.justify}}">
    <block wx:for="{{i.children}}" wx:key="id">
      ${childInvocation}
    </block>
  </view>

  <!-- 2. Row -->
  <view wx:elif="{{i.component === 'Row'}}" class="a2ui-row a2ui-align-{{i.align}} a2ui-justify-{{i.justify}}">
    <view 
      wx:for="{{i.children}}" 
      wx:key="id" 
      class="a2ui-row-item {{(item.weight != null && item.weight !== '') || item.component === 'Column' ? 'a2ui-item-flex' : 'a2ui-item-own'}}" 
      style="{{item.flexStyle ? item.flexStyle : ((item.weight != null && item.weight !== '') ? 'flex: ' + item.weight + ' 1 0%; min-width: 0;' : 'flex: 0 0 auto;')}}"
    >
      ${childInvocation}
    </view>
  </view>

  <!-- 3. Card -->
  <view wx:elif="{{i.component === 'Card'}}" class="a2ui-card">
    <block wx:for="{{i.children}}" wx:key="id">
      ${childInvocation}
    </block>
  </view>

  <!-- 4. Text -->
  <rich-text 
    wx:elif="{{i.component === 'Text' && i.richHtml}}" 
    nodes="{{i.richHtml}}" 
    class="a2ui-text a2ui-text-{{i.variant}}" 
  />
  <text 
    wx:elif="{{i.component === 'Text'}}" 
    class="a2ui-text a2ui-text-{{i.variant}}"
  >{{i.text}}</text>

  <!-- 5. Button -->
  <button 
    wx:elif="{{i.component === 'Button'}}" 
    class="a2ui-btn a2ui-btn-{{i.variant}}" 
    data-id="{{i.id}}" 
    bindtap="handleTap"
    disabled="{{i.disabled}}"
    hover-class="a2ui-btn-hover"
  >
    <block wx:if="{{i.children && i.children.length > 0}}">
      <block wx:for="{{i.children}}" wx:key="id">
        ${childInvocation}
      </block>
    </block>
    <block wx:else>{{i.text || 'Button'}}</block>
  </button>

  <!-- 6. TextField -->
  <view wx:elif="{{i.component === 'TextField'}}" class="a2ui-form-item">
    <text wx:if="{{i.label}}" class="a2ui-label">{{i.label}}</text>
    <input 
      class="a2ui-input {{i.validationError ? 'a2ui-input-error' : ''}} {{i.disabled ? 'a2ui-input-disabled' : ''}}" 
      password="{{i.variant === 'obscured'}}" 
      value="{{i.value}}" 
      disabled="{{i.disabled}}"
      placeholder="{{i.placeholder || ''}}" 
      data-id="{{i.id}}" 
      data-path="{{i.valuePath}}" 
      bindinput="handleInput" 
      bindfocus="handleInputFocus"
      bindblur="handleInputBlur"
    />
    <text wx:if="{{i.validationError}}" class="a2ui-field-error">{{i.validationError}}</text>
  </view>

  <!-- 7. Image -->
  <image 
    wx:elif="{{i.component === 'Image'}}" 
    class="a2ui-image a2ui-image-{{i.variant || 'default'}}" 
    src="{{i.url}}" 
    mode="{{i.fit === 'cover' ? 'aspectFill' : (i.variant === 'avatar' ? 'aspectFill' : 'aspectFit')}}" 
    lazy-load="true"
    webp="true"
  />

  <!-- 8. Icon (Optimized: direct use of pre-parsed node.iconGlyph, O1) -->
  <view wx:elif="{{i.component === 'Icon'}}" class="a2ui-icon a2ui-icon-{{i.name}}">
    <text>{{i.iconGlyph || '✦'}}</text>
  </view>

  <!-- 9. Divider -->
  <view wx:elif="{{i.component === 'Divider'}}" class="a2ui-divider" />

  <!-- 10. CheckBox (Optimized: wrapped in label to support full area tap, L1) -->
  <view wx:elif="{{i.component === 'CheckBox'}}" class="a2ui-checkbox-wrap">
    <checkbox-group class="a2ui-checkbox-group" data-id="{{i.id}}" data-path="{{i.valuePath}}" data-kind="bool" bindchange="handleInput">
      <label class="a2ui-checkbox">
        <checkbox checked="{{i.checked}}" value="true" disabled="{{i.disabled}}" />
        <text class="a2ui-checkbox-label">{{i.label || i.text}}</text>
      </label>
    </checkbox-group>
  </view>

  <!-- 11. Slider -->
  <view wx:elif="{{i.component === 'Slider'}}" class="a2ui-slider-wrap">
    <text wx:if="{{i.label}}" class="a2ui-label">{{i.label}}</text>
    <slider class="a2ui-slider" min="{{i.min}}" max="{{i.max}}" step="{{i.step}}" value="{{i.value}}" show-value="true" disabled="{{i.disabled}}" data-id="{{i.id}}" data-path="{{i.valuePath}}" bindchange="handleInput" />
  </view>

  <!-- 12. ChoicePicker (CR-2 & L1/L2: supports options array, single/multiple chips, and dropdown selector) -->
  <view wx:elif="{{i.component === 'ChoicePicker'}}" class="a2ui-picker-wrap">
    <text class="a2ui-label">{{i.label || 'Select'}}</text>
    <!-- 1. Chips mode (supports single and multiple choice chips, L2) -->
    <view wx:if="{{i.displayStyle === 'chips'}}" class="a2ui-choice-chips-wrap">
      <view 
        wx:for="{{i.options}}" 
        wx:for-item="opt" 
        wx:key="value" 
        class="a2ui-choice-chip {{opt.selected ? 'selected' : ''}} {{i.disabled ? 'disabled' : ''}}"
        data-id="{{i.id}}"
        data-path="{{i.valuePath}}"
        data-val="{{opt.value}}"
        bindtap="onChipSelect"
      >
        <text>{{opt.label}}</text>
      </view>
    </view>
    <!-- 2. Multiple selection list mode (mutuallyExclusive === false or displayStyle === 'checkbox') -->
    <block wx:elif="{{i.mutuallyExclusive === false || i.displayStyle === 'checkbox'}}">
      <checkbox-group class="a2ui-choice-multi-group" data-id="{{i.id}}" data-path="{{i.valuePath}}" data-kind="choice-multi" bindchange="handleInput">
        <label class="a2ui-choice-multi-item {{opt.selected ? 'checked' : ''}}" wx:for="{{i.options}}" wx:for-item="opt" wx:key="value">
          <checkbox value="{{opt.value}}" checked="{{opt.selected}}" disabled="{{i.disabled}}" />
          <text class="a2ui-choice-multi-label">{{opt.label}}</text>
        </label>
      </checkbox-group>
    </block>
    <!-- 3. Default Selector Picker single selection -->
    <picker wx:else mode="selector" range="{{i.options}}" range-key="label" value="{{i.selectedIndex != null && i.selectedIndex !== '' ? i.selectedIndex : 0}}" disabled="{{i.disabled}}" data-id="{{i.id}}" data-path="{{i.valuePath}}" bindchange="handlePickerChange">
      <view class="a2ui-picker-box"><text>{{i.displayLabel || (i.options && i.options[i.selectedIndex] ? i.options[i.selectedIndex].label : (i.value || 'Please select'))}}</text></view>
    </picker>
  </view>

  <!-- 13. DateTimeInput (CR-3: full support for enableDate and enableTime combinations) -->
  <view wx:elif="{{i.component === 'DateTimeInput'}}" class="a2ui-picker-wrap">
    <text class="a2ui-label">{{i.label || 'Date / Time'}}</text>
    <view class="a2ui-datetime-row">
      <picker wx:if="{{i.enableDate !== false}}" mode="date" value="{{i.dateValue}}" disabled="{{i.disabled}}" data-id="{{i.id}}" data-path="{{i.valuePath}}" data-part="date" bindchange="handleDateTimeChange">
        <view class="a2ui-picker-box"><text>📅 {{i.dateValue || 'Select date'}}</text></view>
      </picker>
      <picker wx:if="{{i.enableTime}}" mode="time" value="{{i.timeValue}}" disabled="{{i.disabled}}" data-id="{{i.id}}" data-path="{{i.valuePath}}" data-part="time" bindchange="handleDateTimeChange">
        <view class="a2ui-picker-box"><text>🕒 {{i.timeValue || 'Select time'}}</text></view>
      </picker>
    </view>
  </view>

  <!-- 14. List -->
  <scroll-view 
    wx:elif="{{i.component === 'List' && i.direction === 'horizontal'}}" 
    scroll-x="true" 
    enable-flex="true" 
    enhanced="true"
    show-scrollbar="false"
    fast-deceleration="true"
    class="a2ui-list a2ui-list-horizontal"
  >
    <block wx:for="{{i.children}}" wx:key="id">
      ${childInvocation}
    </block>
  </scroll-view>
  <view wx:elif="{{i.component === 'List'}}" class="a2ui-list-wrap">
    <block wx:for="{{i.children}}" wx:key="id">
      ${childInvocation}
    </block>
  </view>

  <!-- 15. Modal (CR-H6 / CR-15 / L5: uiKey prevents setData property path splitting) -->
  <view wx:elif="{{i.component === 'Modal'}}" class="a2ui-modal-container">
    <view data-id="{{i.id}}" data-uikey="{{i.uiKey}}" bindtap="onModalOpen" wx:if="{{i.triggerNode || (!i.contentNode && i.children && i.children[0])}}">
      ${triggerInvocation}
    </view>
    <view wx:if="{{uiState[i.uiKey + '_open']}}" class="a2ui-modal-mask" data-id="{{i.id}}" data-uikey="{{i.uiKey}}" bindtap="onModalClose" catchtouchmove="noop">
      <view class="a2ui-modal-box" catchtap="noop">
        <text wx:if="{{i.title}}" class="a2ui-text-title">{{i.title}}</text>
        ${contentInvocation}
      </view>
    </view>
  </view>

  <!-- 16. Tabs (CR-H6 / L5: uiKey prevents setData property path splitting) -->
  <view wx:elif="{{i.component === 'Tabs'}}" class="a2ui-tabs-wrap">
    <view class="a2ui-tab-bar" wx:if="{{i.tabs && i.tabs.length > 0}}">
      <view 
        wx:for="{{i.tabs}}" 
        wx:for-item="t" 
        wx:key="childId" 
        data-id="{{i.id}}" 
        data-uikey="{{i.uiKey}}"
        data-idx="{{index}}" 
        class="a2ui-tab-item {{(uiState[i.uiKey] != null ? uiState[i.uiKey] : i.activeTab) === index ? 'active' : ''}}" 
        bindtap="onTabTap"
      >
        <text>{{t.title}}</text>
      </view>
    </view>
    <block wx:for="{{i.children}}" wx:key="id">
      <view wx:if="{{(uiState[i.uiKey] != null ? uiState[i.uiKey] : i.activeTab) === index}}">
        ${childInvocation}
      </view>
    </block>
  </view>

  <!-- 17. AudioPlayer -->
  <view wx:elif="{{i.component === 'AudioPlayer'}}" class="a2ui-audio-card">
    <text class="a2ui-icon">🎵</text>
    <text class="a2ui-text-body">{{i.title || i.name || 'Audio playback'}}</text>
  </view>

  <!-- 18. Video -->
  <video wx:elif="{{i.component === 'Video'}}" class="a2ui-video" src="{{i.url}}" poster="{{i.poster}}" controls="true" />

  <!-- 19. Custom Component (isCustom === true) -->
  <a2ui-node-slot 
    wx:elif="{{i.isCustom}}" 
    node="{{i}}" 
    surfaceId="{{surfaceId}}" 
    uiState="{{uiState}}" 
    scope="{{i.scopeData}}" 
    bind:action="onCustomAction" 
    bind:inputChange="onCustomInput" 
  />

  <!-- Fallback -->
  <view wx:else class="a2ui-fallback">
    <block wx:for="{{i.children}}" wx:key="id">
      ${childInvocation}
    </block>
  </view>
</template>
`;
}

const header = `<!-- 
  A2UI Official 18 Base Component Template System (Auto-generated, 100% structural consistency across levels)
  Generator: scripts/generate-templates.js
-->
<wxs module="tools">
module.exports = {};
</wxs>
`;

const templates = [0, 1, 2, 3, 4].map((lvl) => generateTemplate(lvl, 4)).join('\n\n');
const fullContent = header + '\n' + templates;

const mpTargetPath = path.resolve(__dirname, '../miniprogram/components/a2ui-surface/templates.wxml');
fs.writeFileSync(mpTargetPath, fullContent, 'utf-8');
console.log(`Generated templates.wxml (${fullContent.length} chars) -> ${mpTargetPath}`);
