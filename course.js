const TASK_UI = {
  title: document.getElementById("task__title"),
  text: document.getElementById("task__text"),

  controls: {
    hint: document.getElementById("task-controls__hint"),
    next: document.getElementById("task-controls__next"),
  },
};

let project;
let params = getParams();
initialProjectLoad();
async function initialProjectLoad() {
  project = await loadProject(params.area, params.project);
  updateUI(project, params.task);
}

TASK_UI.controls.next.addEventListener("click", async () => {
  const task = params.task + 1;

  setParams({ ...params, task });
  updateUI(project, task);
});

async function loadProject(area, projectID) {
  const url = "/areas/" + area + "/" + projectID + ".yaml";
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The project does not exist`);
  }

  const text = await response.text();
  const data = jsyaml.load(text);

  return data;
}

function updateUI(project, taskID) {
  const task = project.tasks[taskID];

  const taskTitle = document.createElement("span");
  taskTitle.classList.add("task");
  taskTitle.textContent = `Task ${taskID}`;
  const projectTitle = document.createTextNode(" - " + project.name);
  TASK_UI.title.innerHTML = "";
  TASK_UI.title.appendChild(taskTitle);
  TASK_UI.title.appendChild(projectTitle);

  TASK_UI.text.innerHTML = marked.parse(task.english);
  vm.resize();
}

function getParams() {
  const search = new URLSearchParams(window.location.search);

  return {
    area: search.get("area") || "linux",
    project: +search.get("project") || 0,
    task: +search.get("task") || 0,
  };
}

function setParams(update) {
  const url = new URL(window.location.href);
  Object.entries(update).forEach((param) => url.searchParams.set(...param));
  window.history.pushState(null, "", url); // prevent reload
  params = update;
}
