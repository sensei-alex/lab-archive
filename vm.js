const VM_UI = {
  terminal: document.getElementById("terminal"),
  editor: document.getElementById("editor"),
};

const editor = CodeMirror.fromTextArea(VM_UI.editor);
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
terminal.open(VM_UI.terminal);
terminal.writeln("Downloading system files");

const emulator = new V86({
  wasm_path: "/deps/v86/v86.wasm",
  memory_size: 512 * 1024 * 1024,
  vga_memory_size: 8 * 1024 * 1024,
  disable_keyboard: true,
  disable_mouse: true,
  disable_speaker: true,
  bios: { url: "/deps/v86/seabios.bin" },
  vga_bios: { url: "/deps/v86/vgabios.bin" },
  filesystem: {
    baseurl: "/images/dist/alpine-rootfs-flat",
    basefs: "/images/dist/alpine-fs.json",
  },
  autostart: true,
  bzimage_initrd_from_filesystem: true,
  cmdline:
    "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable",
  initial_state: { url: "/images/dist/alpine-state.bin.zst" }, // from 1.37m to 41s
});

// set up terminal
const vm = {
  async run(command) {
    emulator.serial0_send(command + "\n");

    const receiverId = crypto.randomUUID();

    return new Promise((resolve) => {
      vm.bindReceiver(receiverId, (char) => {
        if (vm.screen.endsWith("$ ") || vm.screen.endsWith("# ")) {
          vm.unbindReceiver(receiverId);
          resolve();
        }
      });
    });
  },
  async resize() {
    fitAddon.fit();
    await vm.run(`stty rows ${terminal.rows} cols ${terminal.cols}`);
  },
  receivers: {
    print: (char) => {
      if (vm.silent) return;
      terminal.write(char);
    },
  },
  bindReceiver(id, fn) {
    vm.receivers[id] = fn;
  },
  unbindReceiver(id) {
    delete vm.receivers[id];
  },
  screen: "",
  silent: true,
  async mute() {
    vm.silent = true;
    VM_UI.terminal.style.filter = "opacity(0.2)";
    await vm.run("history -w");
  },
  async unmute() {
    await vm.run("history -c;history -r");
    VM_UI.terminal.style.filter = "unset";
    vm.silent = false;
  },
  downloadProgress: 0,
};

emulator.add_listener("serial0-output-byte", (byte) => {
  const char = String.fromCharCode(byte);

  vm.screen += char;
  Object.values(vm.receivers).forEach((fn) => fn(char));
});
emulator.add_listener("emulator-started", async () => {
  await vm.resize();

  await vm.unmute();
  await vm.run("clear");

  // clear screen
  await vm.mute();
  await vm.run("rm .bash_history");
  await vm.unmute();
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
async function writeFile(path, data) {
  const lastSlash = path.lastIndexOf("/");
  const directory = path.substring(0, lastSlash);

  await vm.mute();
  await vm.run("rm " + path);
  await vm.run("mkdir -p " + directory);
  emulator.create_file(path, new TextEncoder().encode(data + "\n"));
  await vm.unmute();
}
async function readFile(path) {
  const bytes = await emulator.read_file(path);
  return new TextDecoder().decode(bytes);
}
editor.on("blur", () => writeFile("/home/me/example.c", editor.doc.getValue()));
emulator.add_listener("9p-write-end", async (args) => {
  if (args[0] !== "example.c") {
    return;
  }
  const data = await readFile("/home/me/example.c");
  editor.doc.setValue(data);
});
emulator.add_listener("download-progress", (event) => {
  const progress = event.loaded / event.total;
  if (!Number.isFinite(progress)) return;

  const bars = Math.ceil((terminal.cols - 2) * progress);

  if (bars < vm.downloadProgress) {
    vm.downloadProgress = bars;
  }
  if (bars == vm.downloadProgress) return;

  vm.downloadProgress = bars;
  terminal.write("\x1b[2;1H" + "#".repeat(bars) + " ".repeat(terminal.cols));
  terminal.write(
    "\x1b[1;" +
      "Downloading system files ".length +
      "H: " +
      Math.floor(progress * 100) +
      "% ",
  );
});

// Fix the ctrl+shift+c behavior
VM_UI.terminal.addEventListener("keydown", function (event) {
  if (event.ctrlKey && event.shiftKey && event.keyCode === 67) {
    // Prevent the default behavior (copying)
    event.preventDefault();
    const text = terminal.getSelection();
    navigator.clipboard.writeText(text);
  }
});
