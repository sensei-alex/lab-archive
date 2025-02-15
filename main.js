const ui = {
  terminal: document.getElementById("terminal"),
  editor: document.getElementById("editor"),
};

const editor = CodeMirror.fromTextArea(ui.editor);
editor.setOption("theme", "ctp-mocha");
editor.setOption("indentUnit", 4);
editor.setOption("mode", "text/x-csrc");
editor.setOption("lineNumbers", true);
editor.setOption(
  "value",
  `#include <stdio.h>

int main() {
  printf("Hello, world!\\n");
  return 0;
}
`,
);

const terminal = new Terminal({
  fontFamily: "JetBrainsMono, monospace",
  fontSize: 16,
  letterSpacing: 0, // thanks https://github.com/xtermjs/xterm.js/issues/2963#issuecomment-812031516
  theme: {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    selectionBackground: "#f5e0dc",
    selectionForeground: "#1e1e2e",
    black: "#45475a",
    red: "#f38ba8",
    green: "#a6e3a1",
    yellow: "#f9e2af",
    blue: "#89b4fa",
    magenta: "#f5c2e7",
    cyan: "#94e2d5",
    white: "#bac2de",
    brightBlack: "#585b70",
    brightRed: "#f38ba8",
    brightGreen: "#a6e3a1",
    brightYellow: "#f9e2af",
    brightBlue: "#89b4fa",
    brightMagenta: "#f5c2e7",
    brightCyan: "#94e2d5",
    brightWhite: "#a6adc8",
  },
});
const fitAddon = new FitAddon.FitAddon();
terminal.loadAddon(fitAddon);
terminal.open(ui.terminal);
terminal.write("Loading...\n\n");

const emulator = new V86({
  wasm_path: "./v86.wasm",
  memory_size: 512 * 1024 * 1024,
  vga_memory_size: 8 * 1024 * 1024,
  disable_keyboard: true,
  disable_mouse: true,
  disable_speaker: true,
  bios: { url: "./seabios.bin" },
  vga_bios: { url: "./vgabios.bin" },
  filesystem: {
    baseurl: "./images/dist/alpine-rootfs-flat",
    basefs: "./images/dist/alpine-fs.json",
  },
  autostart: true,
  bzimage_initrd_from_filesystem: true,
  cmdline:
    "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable",
  initial_state: { url: "./images/dist/alpine-state.bin" },
});

// set up terminal
emulator.add_listener("serial0-output-byte", (byte) => {
  const char = String.fromCharCode(byte);
  terminal.write(char);
});
emulator.add_listener("emulator-started", () => {
  fitAddon.fit();
  run(`stty rows ${terminal.rows} cols ${terminal.cols}`);

  run("clear");
});
terminal.onData((data) => emulator.serial0_send(data));

function run(command) {
  emulator.serial0_send(command + "\n");
}

// set up a network so that multiple machines can talk to each other
const broadcast = new BroadcastChannel("v86-network");
broadcast.addEventListener("message", (event) =>
  emulator.bus.send("net0-receive", event.data),
);
emulator.add_listener("net0-send", (packet) => broadcast.postMessage(packet));

// set up file sharing
function writeFile(path, data) {
  const idx = emulator.fs9p.SearchPath(path).id;

  if (idx === -1) {
    emulator.create_file(path, new Uint8Array([]));

    writeFile(path, data);
    return;
  }

  const bytes = new TextEncoder().encode(data + "\n");

  emulator.fs9p.ChangeSize(idx, bytes.length);
  emulator.fs9p.Write(idx, 0, bytes.length, bytes);
}
async function readFile(path) {
  const bytes = await emulator.read_file(path);
  const text = new TextDecoder().decode(bytes);

  editor.doc.setValue(text);
}
editor.on("blur", (event) =>
  writeFile("/root/example.c", editor.doc.getValue()),
);
emulator.add_listener("9p-write-end", (args) => {
  if (args[0] !== "example.c") {
    return;
  }
  readFile("/root/example.c");
});
