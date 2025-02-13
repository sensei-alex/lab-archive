#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
// three .. up is just ../ in my case
const V86 = require("./../libv86.js").V86;

const V86_ROOT = path.join(__dirname, "..");
const OUTPUT_FILE = path.join(V86_ROOT, "images/dist/alpine-state.bin");

var emulator = new V86({
  bios: { url: path.join(V86_ROOT, "seabios.bin") },
  vga_bios: { url: path.join(V86_ROOT, "vgabios.bin") },
  autostart: true,
  memory_size: 512 * 1024 * 1024,
  vga_memory_size: 8 * 1024 * 1024,
  network_relay_url: "<UNUSED>",
  bzimage_initrd_from_filesystem: true,
  cmdline:
    "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable init_on_free=on",
  filesystem: {
    baseurl: path.join(V86_ROOT, "images/dist/alpine-rootfs-flat"),
    basefs: path.join(V86_ROOT, "images/dist/alpine-fs.json"),
  },
});

console.log("Booting the VM. This might take a minute.");

let serial_text = "";
let booted = false;

emulator.add_listener("serial0-output-byte", function (byte) {
  const c = String.fromCharCode(byte);

  serial_text += c;

  if (!booted && serial_text.endsWith("localhost:~# ")) {
    booted = true;

    console.log("Saving initial state...");

    emulator.serial0_send(
      "ash\nexport TERM=xterm-256color;sync;echo 3 >/proc/sys/vm/drop_caches\n",
    );

    setTimeout(async function () {
      const s = await emulator.save_state();

      fs.writeFile(OUTPUT_FILE, new Uint8Array(s), function (e) {
        if (e) throw e;
        console.log("Done");
        emulator.destroy();
      });
    }, 10 * 1000);
  }
});
