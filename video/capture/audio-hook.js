// WebAudio の出力（ctx.destination へつながる音）を MediaStreamDestination にも流し、MediaRecorder で録る。
// window.__stopAudio() で録音を止め、webm(opus) を base64 で返す。
(() => {
  const chunks = [];
  let rec = null;
  let dest = null;
  const original = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (target, ...rest) {
    const ctx = this.context;
    if (target === ctx.destination) {
      if (!dest) {
        dest = ctx.createMediaStreamDestination();
        rec = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus" });
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.start(250);
        window.__audioStartedAt = performance.now();
      }
      original.call(this, dest);
    }
    return original.call(this, target, ...rest);
  };
  window.__stopAudio = () =>
    new Promise((resolve) => {
      if (!rec) return resolve(null);
      rec.onstop = async () => {
        const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
        let s = "";
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        resolve(btoa(s));
      };
      rec.stop();
    });
})();
