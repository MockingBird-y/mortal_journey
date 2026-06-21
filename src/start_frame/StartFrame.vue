<script setup lang="ts">
import { computed, watch } from "vue";
import { useSplash, type SaveIndexEntry, type MjSavePayload } from "./useSplash";
import { useScrollLock } from "../composables/useScrollLock";
import "./start_frame.css";

const props = defineProps<{
  mainScreenVisible: boolean;
}>();

const emit = defineEmits<{
  (e: "start-new-life"): void;
  (e: "save-loaded", value: { id: string; payload: MjSavePayload }): void;
}>();

const scrollLock = useScrollLock();

const {
  apiModalOpen,
  saveModalOpen,
  helpModalOpen,
  apiUrl,
  apiKey,
  apiModel,
  apiStatus,
  apiStatusOk,
  saveStatus,
  saveStatusOk,
  saves,
  canStart,
  fmtTime,
  openApiSettings,
  closeApiSettings,
  saveApiSettings,
  clearApiSettings,
  testApiSettings,
  openSaveLoad,
  closeSaveLoad,
  openHelp,
  closeHelp,
  refreshSaveList,
  loadSave,
  deleteSave,
  deleteAllSaves,
} = useSplash();

watch(
  [apiModalOpen, saveModalOpen, helpModalOpen],
  ([am, sm, hm]) => {
    if (am || sm || hm) scrollLock.acquire();
    else scrollLock.release();
  },
);

const startDisabledTitle = computed(() =>
  canStart.value
    ? undefined
    : "请先在「API设置」中配置 API URL / Key / 模型（本地代理可不填 Key）。",
);

function onStartNewLife() {
  emit("start-new-life");
}

function onLoadSave(it: SaveIndexEntry) {
  const res = loadSave(it);
  if (res) emit("save-loaded", res);
}
</script>

<template>
  <div id="splash-screen">
    <div id="splash-bg" aria-hidden="true"></div>

    <div id="splash-content">
      <h1 id="splash-title">凡人修仙传</h1>
      <p id="splash-info">作者: KAI&nbsp;&nbsp;|&nbsp;&nbsp;版本: 2.0.0</p>

      <div id="splash-buttons">
        <button
          id="start-new-life-btn"
          class="splash-btn"
          type="button"
          :disabled="!canStart"
          :title="startDisabledTitle"
          @click="onStartNewLife"
        >
          开始游戏
        </button>
        <button
          id="help-btn"
          class="splash-btn"
          type="button"
          @click="openHelp"
        >
          游玩说明
        </button>
        <button
          id="load-life-btn"
          class="splash-btn"
          type="button"
          :disabled="!canStart"
          :title="startDisabledTitle"
          @click="openSaveLoad"
        >
          读取人生
        </button>
        <button class="splash-btn" id="api-settings-btn" type="button" @click="openApiSettings">
          API设置
        </button>
      </div>
    </div>
  </div>

  <Transition name="mj-backdrop">
    <div
      v-if="apiModalOpen"
      id="api-settings-root"
      class="splash-modal-root"
      aria-hidden="false"
      @keydown="(e: KeyboardEvent) => { if (e.key === 'Escape') { closeApiSettings(); e.preventDefault(); } }"
    >
      <div class="splash-modal-backdrop" tabindex="-1" @click="closeApiSettings"></div>
      <Transition name="mj-modal" appear>
        <div class="splash-modal" role="dialog" aria-modal="true" aria-labelledby="api-settings-title">
      <button type="button" class="splash-modal-close" aria-label="关闭" @click="closeApiSettings">×</button>
      <h3 id="api-settings-title" class="splash-modal-title">API 设置</h3>
      <p class="splash-modal-sub">目前仅支持OpenAI格式的api。</p>

      <div class="splash-form">
        <label class="splash-field">
          <span class="splash-field-k">API URL</span>
          <input
            v-model="apiUrl"
            class="splash-field-input"
            type="text"
            placeholder="https://api.example.com/v1"
          />
        </label>
        <label class="splash-field">
          <span class="splash-field-k">API Key</span>
          <input
            v-model="apiKey"
            class="splash-field-input"
            type="password"
            placeholder="sk-..."
          />
        </label>
        <label class="splash-field">
          <span class="splash-field-k">模型</span>
          <input
            v-model="apiModel"
            class="splash-field-input"
            type="text"
            placeholder="gpt-4.1-mini"
          />
        </label>
      </div>

      <div class="splash-modal-actions splash-modal-actions--3">
        <button type="button" class="splash-btn splash-btn--secondary" @click="clearApiSettings">
          清除
        </button>
        <button type="button" class="splash-btn splash-btn--secondary" @click="testApiSettings">
          测试
        </button>
        <button type="button" class="splash-btn" @click="saveApiSettings">保存</button>
      </div>
      <div
        class="splash-modal-status"
        :class="{
          'splash-modal-status--ok': apiStatusOk && apiStatus,
          'splash-modal-status--bad': !apiStatusOk && apiStatus,
        }"
        aria-live="polite"
      >
        {{ apiStatus }}
      </div>
    </div>
      </Transition>
    </div>
  </Transition>

  <Transition name="mj-backdrop">
    <div
      v-if="saveModalOpen"
      id="save-load-root"
      class="splash-modal-root"
      aria-hidden="false"
    @keydown="(e: KeyboardEvent) => { if (e.key === 'Escape') { closeSaveLoad(); e.preventDefault(); } }"
  >
    <div class="splash-modal-backdrop" tabindex="-1" @click="closeSaveLoad"></div>
    <Transition name="mj-modal" appear>
      <div class="splash-modal splash-modal--wide" role="dialog" aria-modal="true" aria-labelledby="save-load-title">
      <button type="button" class="splash-modal-close" aria-label="关闭" @click="closeSaveLoad">×</button>
      <h3 id="save-load-title" class="splash-modal-title">读取人生</h3>
      <p class="splash-modal-sub">选择一个存档继续修行（存档保存在本机浏览器中）。</p>
      <div class="save-load-list">
        <p v-if="!saves.length" class="save-load-empty">暂无存档。请先在「开始游戏」里创建一个存档。</p>
        <div v-for="it in saves" :key="it.id" class="save-load-row">
          <div class="save-load-info">
            <p class="save-load-name">{{ it.name || it.id }}</p>
            <p v-if="it.realm || it.location" class="save-load-meta">{{ it.realm }}<template v-if="it.realm && it.location"> · </template>{{ it.location }}</p>
            <p class="save-load-meta">创建：{{ fmtTime(it.createdAt) }} · 更新：{{ fmtTime(it.updatedAt) }}</p>
          </div>
          <div class="save-load-actions">
            <button type="button" class="splash-btn" @click="onLoadSave(it)">读取</button>
            <button type="button" class="splash-btn splash-btn--secondary" @click="deleteSave(it)">
              删除
            </button>
          </div>
        </div>
      </div>
      <div class="splash-modal-actions splash-modal-actions--2">
        <button type="button" class="splash-btn splash-btn--secondary" @click="refreshSaveList">
          刷新
        </button>
        <button type="button" class="splash-btn splash-btn--secondary" @click="deleteAllSaves">清空</button>
      </div>
      <div
        class="splash-modal-status"
        :class="{
          'splash-modal-status--ok': saveStatusOk && saveStatus,
          'splash-modal-status--bad': !saveStatusOk && saveStatus,
        }"
        aria-live="polite"
      >
        {{ saveStatus }}
      </div>
      </div>
      </Transition>
    </div>
  </Transition>

  <Transition name="mj-backdrop">
    <div
      v-if="helpModalOpen"
      id="help-root"
      class="splash-modal-root"
      aria-hidden="false"
      @keydown="(e: KeyboardEvent) => { if (e.key === 'Escape') { closeHelp(); e.preventDefault(); } }"
    >
      <div class="splash-modal-backdrop" tabindex="-1" @click="closeHelp"></div>
      <Transition name="mj-modal" appear>
        <div class="splash-modal splash-modal--wide" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <button type="button" class="splash-modal-close" aria-label="关闭" @click="closeHelp">×</button>
          <h3 id="help-title" class="splash-modal-title">游玩说明</h3>
          <div class="help-content">
            <section class="help-section">
              <h4 class="help-h">游戏目标</h4>
              <p class="help-p">
                你将扮演一名修仙者，在有限的寿元内不断突破境界，追寻长生大道。开局可选难度：
                <span class="help-em">简单</span>（长生无虞）/
                <span class="help-em">正常</span>（寿元有尽）/
                <span class="help-em">困难</span>（修士皆非凡俗）。
              </p>
            </section>
            <section class="help-section">
              <h4 class="help-h">境界之路</h4>
              <p class="help-p">
                5 大境界：练气 → 筑基 → 结丹 → 元婴 → 化神；每个大境界分 初期 / 中期 / 后期，共 15 阶。
                每提升一阶，主属性、HP/MP 上限、寿元上限都会重置刷新。
              </p>
            </section>
            <section class="help-section">
              <h4 class="help-h">修为与突破</h4>
              <p class="help-p">
                修为是数值（不是百分比），每境界有固定门槛（如练气初期需 2000）。修为攒满后会触发
                「突破任务」（由剧情推动），完成后境界提升、修为归零。突破失败不会损失修为，但可能折损气血、灵石或时间。
              </p>
            </section>
            <section class="help-section">
              <h4 class="help-h">功法 —— 核心提升方式</h4>
              <p class="help-p">
                功法有 8 个槽位，每门功法可修炼到 1-10 层熟练度。消耗灵石闭关修炼，每颗灵石约换 100 熟练度经验。
              </p>
              <p class="help-p help-highlight">
                ★ 关键规则：功法熟练度的提升会等额加到修为上 —— 修炼功法就是提升修为，是中后期成长的核心。
              </p>
              <p class="help-p">
                功法分下品 → 中品 → 上品 → 极品 → 仙品 → 神品 6 级品阶，以及 剑修 / 体修 / 法修 / 毒修 / 通用 五种体系，
                影响修炼速度与战斗效果。
              </p>
            </section>
            <section class="help-section">
              <h4 class="help-h">灵根与属性</h4>
              <p class="help-p">
                灵根越少越好：天灵根（1 根）修炼最快，伪灵根（5 根）最慢。金木水火土五行各自提供独立加成
                （暴击伤 / 丹药效 / 冷却 / 恢复 / 护盾）。
              </p>
              <p class="help-p">
                八项主属性：体魄 / 灵力 / 劲力 / 神识 / 护体 / 灵御 / 身法 / 悟性；悟性影响修炼速度，体魄与灵力决定 HP/MP 上限。
              </p>
            </section>
            <section class="help-section">
              <h4 class="help-h">剧情 · 战斗 · 存档</h4>
              <ul class="help-list">
                <li>对话框自由输入推进剧情，每回合由 AI 生成故事与状态；底部有「激进 / 中庸 / 谨慎 / 最谨慎」四档快捷行动建议。</li>
                <li>战斗由剧情触发，采用回合制 + 行动条，含暴击、闪避、护盾、反伤等机制。</li>
                <li>每回合自动存档到本机浏览器，刷新页面可续玩；也可在标题界面用「读取人生」加载历史存档。</li>
              </ul>
            </section>
          </div>
          <div class="splash-modal-actions">
            <button type="button" class="splash-btn" @click="closeHelp">明白了</button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
