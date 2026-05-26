import { computed, onMounted, type ComputedRef, type Ref, ref } from "vue";
import { safeJsonParse } from "../ai/openAiChatBridge";
import {
  useApiConfig,
  isApiConfigured,
  API_OVERRIDE_KEY,
} from "../ai/useApiConfig";
import type { ApiOverrideStored } from "../ai/useApiConfig";

export { API_OVERRIDE_KEY } from "../ai/useApiConfig";
export type { ApiOverrideStored } from "../ai/useApiConfig";
export { isApiConfigured } from "../ai/useApiConfig";

export const SAVE_INDEX_KEY = "MJ_SAVES_INDEX_V1";
export const SAVE_PREFIX = "MJ_SAVE_V1:";
export const ACTIVE_SAVE_ID_KEY = "MJ_ACTIVE_SAVE_ID_V1";
export const BOOTSTRAP_KEY = "vue_splash_bootstrap_v1";
export const LAST_SESSION_MIRROR_KEY = "vue_splash_last_session_v1";

export interface SaveIndexEntry {
  id: string;
  name?: string;
  updatedAt?: number;
  createdAt?: number;
}

interface SavePayload {
  fateChoice?: unknown;
  [key: string]: unknown;
}

export interface UseSplashReturn {
  apiModalOpen: Ref<boolean>;
  saveModalOpen: Ref<boolean>;
  apiUrl: Ref<string>;
  apiKey: Ref<string>;
  apiModel: Ref<string>;
  apiStatus: Ref<string>;
  apiStatusOk: Ref<boolean>;
  saveStatus: Ref<string>;
  saveStatusOk: Ref<boolean>;
  saves: Ref<SaveIndexEntry[]>;
  canStart: ComputedRef<boolean>;
  fmtTime: (ts: number | undefined) => string;
  openApiSettings: () => void;
  closeApiSettings: () => void;
  saveApiSettings: () => void;
  clearApiSettings: () => void;
  testApiSettings: () => void;
  openSaveLoad: () => void;
  closeSaveLoad: () => void;
  refreshSaveList: () => void;
  loadSave: (it: SaveIndexEntry) => void;
  deleteSave: (it: SaveIndexEntry) => void;
  deleteAllSaves: () => void;
}

export function useSplash(): UseSplashReturn {
  const { apiUrl, apiKey, apiModel, loadFromStorage, save, clear, test } = useApiConfig();

  const apiModalOpen = ref(false);
  const saveModalOpen = ref(false);
  const apiStatus = ref("");
  const apiStatusOk = ref(true);
  const saveStatus = ref("");
  const saveStatusOk = ref(true);
  const saves = ref<SaveIndexEntry[]>([]);

  const canStart = computed(() => isApiConfigured());

  function setApiStatus(msg: string | null | undefined, ok: boolean): void {
    apiStatus.value = msg != null ? String(msg) : "";
    apiStatusOk.value = !!ok;
  }

  function openApiSettings(): void {
    apiStatus.value = "";
    loadFromStorage();
    apiModalOpen.value = true;
  }

  function closeApiSettings(): void {
    apiModalOpen.value = false;
  }

  function saveApiSettings(): void {
    const result = save();
    const ok = result === "已保存。";
    setApiStatus(result, ok);
  }

  function clearApiSettings(): void {
    clear();
    setApiStatus("已清除。", true);
  }

  function testApiSettings(): void {
    setApiStatus("正在测试连接…", true);
    test().then((result) => {
      const ok = result.startsWith("测试成功");
      setApiStatus(result, ok);
    });
  }

  function readSaveIndex(): SaveIndexEntry[] {
    try {
      const raw = localStorage.getItem(SAVE_INDEX_KEY);
      const arr = raw ? safeJsonParse<unknown>(raw, []) : [];
      return Array.isArray(arr) ? (arr as SaveIndexEntry[]) : [];
    } catch {
      return [];
    }
  }

  function writeSaveIndex(arr: SaveIndexEntry[]): void {
    try {
      localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));
    } catch {
      /* ignore */
    }
  }

  function fmtTime(ts: number | undefined): string {
    const n = Number(ts);
    if (!isFinite(n) || n <= 0) return "—";
    const d = new Date(n);
    const pad = (x: number): string => (x < 10 ? "0" + x : String(x));
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  }

  function refreshSaveList(): void {
    const idx = readSaveIndex();
    idx.sort((a, b) => Number(b?.updatedAt) - Number(a?.updatedAt));
    saves.value = idx.filter((x): x is SaveIndexEntry => Boolean(x && x.id));
  }

  function openSaveLoad(): void {
    saveStatus.value = "";
    saveModalOpen.value = true;
    refreshSaveList();
  }

  function closeSaveLoad(): void {
    saveModalOpen.value = false;
  }

  function setSaveStatus(msg: string | null | undefined, ok: boolean): void {
    saveStatus.value = msg != null ? String(msg) : "";
    saveStatusOk.value = !!ok;
  }

  function loadSave(it: SaveIndexEntry): void {
    try {
      const raw = localStorage.getItem(SAVE_PREFIX + String(it.id));
      if (!raw) {
        setSaveStatus("读取失败：存档内容不存在。", false);
        return;
      }
      const data = safeJsonParse<SavePayload | null>(raw, null);
      if (!data || !data.fateChoice) {
        setSaveStatus("读取失败：存档内容损坏。", false);
        return;
      }
      try {
        localStorage.removeItem(LAST_SESSION_MIRROR_KEY);
      } catch {
        /* ignore */
      }
      sessionStorage.setItem(BOOTSTRAP_KEY, JSON.stringify(data));
      sessionStorage.setItem(ACTIVE_SAVE_ID_KEY, String(it.id));
      localStorage.setItem(ACTIVE_SAVE_ID_KEY, String(it.id));
      setSaveStatus("主界面尚未接入；已写入会话启动数据，后续接上主工程后可从此继续。", true);
    } catch (e) {
      const err = e instanceof Error ? e.message : "未知错误";
      setSaveStatus("读取失败：" + err, false);
    }
  }

  function deleteSave(it: SaveIndexEntry): void {
    const msg = "确定删除存档「" + String(it.name || it.id) + "」？\n此操作不可撤销。";
    if (!window.confirm(msg)) return;
    try {
      localStorage.removeItem(SAVE_PREFIX + String(it.id));
      const idx2 = readSaveIndex().filter((x) => x && String(x.id || "") !== String(it.id));
      writeSaveIndex(idx2);
      try {
        const curAct = localStorage.getItem(ACTIVE_SAVE_ID_KEY) || "";
        if (curAct && String(curAct) === String(it.id)) {
          localStorage.removeItem(ACTIVE_SAVE_ID_KEY);
          localStorage.removeItem(LAST_SESSION_MIRROR_KEY);
        }
      } catch {
        /* ignore */
      }
      refreshSaveList();
      setSaveStatus("已删除。", true);
    } catch (e) {
      const err = e instanceof Error ? e.message : "未知错误";
      setSaveStatus("删除失败：" + err, false);
    }
  }

  function deleteAllSaves(): void {
    const msg = "确定清空全部存档？\n此操作不可撤销。";
    if (!window.confirm(msg)) return;
    try {
      const idx3 = readSaveIndex();
      for (let i = 0; i < idx3.length; i++) {
        if (idx3[i]?.id) localStorage.removeItem(SAVE_PREFIX + String(idx3[i].id));
      }
      writeSaveIndex([]);
      refreshSaveList();
      setSaveStatus("已清空。", true);
    } catch (e) {
      const err = e instanceof Error ? e.message : "未知错误";
      setSaveStatus("清空失败：" + err, false);
    }
  }

  onMounted(() => {
    loadFromStorage();
  });

  return {
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
  };
}
