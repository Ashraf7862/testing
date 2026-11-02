const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let toastTimer;
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600)};
async function api(url, options={}) {
  const res=await fetch(url,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}
function navigate(page){
  $$(".page").forEach(p=>p.classList.toggle("active",p.id===page));
  $$(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===page));
  const names={dashboard:"Dashboard",tasks:"My Tasks",feedback:"Submit Feedback",history:"Feedback History"};
  $("#page-title").textContent=names[page]||"Dashboard";
  if(page==="history") loadFeedback();
  if(page==="tasks") loadTasks();
}
$$(".nav").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));

// Theme management
const THEME_KEY = 'quicktask-theme';
const themeToggle = $('#theme-toggle');
const html = document.documentElement;

function getInitialTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  html.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = html.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

// Initialize theme on load
applyTheme(getInitialTheme());

// Listen for system theme changes (only if user hasn't set a preference)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem(THEME_KEY)) {
    applyTheme(e.matches ? 'dark' : 'light');
  }
});

// Toggle button click
themeToggle.addEventListener('click', toggleTheme);

function taskHTML(task){
  return `<div class="task-row ${task.completed?'done':''}">
    <input class="task-check" type="checkbox" ${task.completed?'checked':''} aria-label="Mark task complete" data-toggle="${task.id}">
    <span class="task-name">${escapeHTML(task.title)}</span>
    <button class="delete-task" data-delete="${task.id}" aria-label="Delete task">×</button>
  </div>`;
}
function escapeHTML(value){return String(value).replace(/[&<>"]'/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function loadTasks(){
  try{
    const data=await api("/api/tasks");
    $("#total-tasks").textContent=data.total;
    $("#completed-tasks").textContent=data.completed;
    $("#pending-tasks").textContent=data.pending;
    $("#task-count").textContent=`${data.total} tasks`;
    $("#dashboard-tasks").innerHTML=data.items.length?data.items.slice(0,5).map(taskHTML).join(""):'<div class="empty">No tasks yet. Add your first task.</div>';
    $("#all-tasks").innerHTML=data.items.length?data.items.map(taskHTML).join(""):'<div class="empty">No tasks yet. Add one above.</div>';
  }catch(e){toast(e.message)}
}
document.addEventListener("change",async e=>{
  if(e.target.matches("[data-toggle]")){
    try{await api(`/api/tasks/${e.target.dataset.toggle}`,{method:"PATCH",body:JSON.stringify({completed:e.target.checked})});loadTasks()}
    catch(err){toast(err.message)}
  }
});
document.addEventListener("click",async e=>{
  const id=e.target.dataset.delete;
  if(id){try{await api(`/api/tasks/${id}`,{method:"DELETE"});loadTasks();toast("Task deleted")}catch(err){toast(err.message)}}
});
$("#task-form").addEventListener("submit",async e=>{
  e.preventDefault();const input=$("#task-title");const title=input.value.trim();if(!title)return;
  try{await api("/api/tasks",{method:"POST",body:JSON.stringify({title})});input.value="";loadTasks();toast("Task added")}catch(err){toast(err.message)}
});

$("#feedback-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const payload={
    name:$("#fb-name").value.trim()||null,
    email:$("#fb-email").value.trim()||null,
    category:$("#fb-category").value,
    title:$("#fb-title").value.trim(),
    description:$("#fb-description").value.trim(),
    rating:parseInt($("input[name=rating]:checked").value||0,10)
  };
  if(!payload.category||!payload.title||!payload.description||!payload.rating){toast("Please fill all required fields");return}
  try{await api("/api/feedback",{method:"POST",body:JSON.stringify(payload)});$("#feedback-form").reset();toast("Feedback submitted — thank you!");navigate("history")}catch(err){toast(err.message)}
});

async function loadFeedback(){
  try{
    const data=await api("/api/feedback?limit=50");
    $("#feedback-count").textContent=data.total;
    if(!data.items.length){$("#feedback-list").innerHTML='<div class="empty">No feedback yet. Be the first to share your thoughts!</div>';return}
    $("#feedback-list").innerHTML=data.items.map(fb=>`<article class="feedback-card">
      <div class="feedback-head">
        <div class="feedback-meta">
          <span class="feedback-name">${escapeHTML(fb.name||"Anonymous")}</span>
          <small>${new Date(fb.created_at).toLocaleDateString(undefined,{dateStyle:"medium",timeStyle:"short"})}</small>
        </div>
        <span class="feedback-category">${escapeHTML(fb.category)}</span>
      </div>
      <h4 class="feedback-title">${escapeHTML(fb.title)}</h4>
      <p class="feedback-desc">${escapeHTML(fb.description)}</p>
      <div class="feedback-rating"><span class="stars">${"★".repeat(fb.rating)}${"☆".repeat(5-fb.rating)}</span><span style="color:var(--muted);font-size:12px">${fb.rating}/5</span></div>
    </article>`).join("");
  }catch(e){toast(e.message)}
}

// Initial load
loadTasks();
loadFeedback();