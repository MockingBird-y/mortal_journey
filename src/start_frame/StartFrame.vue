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
  refreshSaveList,
  loadSave,
  deleteSave,
  deleteAllSaves,
} = useSplash();

watch(
  [apiModalOpen, saveModalOpen],
  ([am, sm]) => {
    if (am || sm) scrollLock.acquire();
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
          开始新人生
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
        <p v-if="!saves.length" class="save-load-empty">暂无存档。请先在「开始新人生」里创建一个存档。</p>
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
</template>
