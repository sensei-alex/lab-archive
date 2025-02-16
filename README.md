## Libraries used

All binary files, the `images` directory, and the `libv86.js` are taken from [copy's v86](https://github.com/copy/v86)
which is under the [Simplified BSD License](https://github.com/copy/v86/blob/master/LICENSE).

Some files are modified

`codemirror.css`, `codemirror.js` and `clike.js` are taken from [CodeMirror 5](https://codemirror.net/5/)
licensed under [MIT](https://github.com/codemirror/codemirror5/blob/master/LICENSE).

`themes` are downloaded from [catppuccin for codemirror](https://github.com/catppuccin/codemirror)
licensed under [MIT](https://github.com/catppuccin/codemirror/blob/main/LICENSE).

## Course structure

```mermaid
flowchart TD
Course --> Area
Area --> Project
Area --> Lesson
Project --> Task
Lesson --> Step
```

Areas:

- Linux (writing)
- C / C++
- Embedded development
- Bash scripting
- Networking
- Web

In the source code, both lessons and projects are called projects.
Both steps and tasks are called tasks.

## Project structure

```ts
type Project = {
  name: string; // the title
  layout: "terminal" | "editor"; // a flag to show the editor beside the terminal
  files?: { path: string; text: string }[]; // a list of files to insert into the VM, paths are absolute
  tasks: Task[];
};

type Task = {
  english: string; // Theory / assignment block in English, supports markdown
  russian: string; // Блок теории / задания на русском, поддерживает markdown
  hint?: string; // supports markdown
  answers: Answer[]; // possible answers
};

type Answer =
  | { command: string }
  | { commands: string[] } // if there are commands between these, they are ignored
  | { prompt: string };
// probably I'll add others
```

## VM interface

There is a global `vm` object which has:

- `send(command: string): void` and runs it immediately
- `screen: string` shows the output since the start of the VM
- `resize(): void` resizes the terminal and runs the `stty` command
- `bindReceiver(fn: (char: string) => void): void` will call the receiver when a character is printed
