import { ref, watch, type Ref } from "vue";

export function useTypewriter(source: Ref<string>, speed = 30) {
  const displayed = ref("");
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clear() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  watch(source, (newVal) => {
    clear();
    if (!newVal) {
      displayed.value = "";
      return;
    }

    const prev = displayed.value;
    let startIdx = 0;
    if (newVal.startsWith(prev) && prev.length > 0) {
      startIdx = prev.length;
    } else {
      displayed.value = "";
    }

    let i = startIdx;
    function tick() {
      if (i < newVal.length) {
        displayed.value += newVal[i];
        i++;
        timer = setTimeout(tick, speed);
      }
    }
    tick();
  }, { immediate: true });

  function skipToEnd() {
    clear();
    displayed.value = source.value;
  }

  return { displayed, skipToEnd };
}
