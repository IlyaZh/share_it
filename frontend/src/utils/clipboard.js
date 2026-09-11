export async function copyToClipboard(text) {
  if (!text) return false;

  // 1. Try modern navigator.clipboard API if available and secure context
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed, trying fallback:", err);
    }
  }

  // 2. Try execCommand fallback (optimized for iOS, iPadOS, Android, and HTTP contexts)
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Position offscreen without hiding or making readonly
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "-9999px";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    textArea.style.fontSize = "16px"; // Prevents zoom on iOS

    // CRITICAL for iOS & iPadOS: DO NOT set readOnly or readonly attribute!
    // Safari on iOS/iPadOS ignores selection on read-only inputs/textareas.
    textArea.readOnly = false;

    document.body.appendChild(textArea);

    // iPadOS 13+ identifies as MacIntel with touch points
    const isIOS = /ipad|iphone|ipod/i.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS) {
      const range = document.createRange();
      range.selectNodeContents(textArea);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      textArea.setSelectionRange(0, 999999);
    } else {
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, 999999);
    }

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      return true;
    }
  } catch (err) {
    console.warn("execCommand fallback failed:", err);
  }

  // 3. Try Web Share API (native share sheet on iPad / Android / mobile)
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Secure Storage',
        url: text
      });
      return true;
    } catch (shareErr) {
      if (shareErr.name !== 'AbortError') {
        console.warn("navigator.share failed:", shareErr);
      }
    }
  }

  // 4. Prompt fallback so user can copy manually on any browser
  try {
    const result = window.prompt("Скопируйте ссылку:", text);
    return result !== null;
  } catch (e) {
    return false;
  }
}


