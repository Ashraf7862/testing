const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let toastTimer;
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600)}
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

function taskHTML(task){
  return `<div class="task-row ${task.completed?'done':''}">
    <input class="task-check" type="checkbox" ${task.completed?'checked':''} aria-label="Mark task complete" data-toggle="${task.id}">
    <span class="task-name">${escapeHTML(task.title)}</span>
    <button class="delete-task" data-delete="${task.id}" aria-label="Delete task">×</button>
  </div>`;
}
function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
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
  try{await api("/api/tasks",{method:"POST",body:JSON.stringify({title})});input.value="";loadTasks();toast("Task added")}
  catch(err){toast(err.message)}
});
$("#feedback-form").addEventListener("submit",async e=>{
  e.preventDefault();const form=e.currentTarget;const data=Object.fromEntries(new FormData(form).entries());data.rating=Number(data.rating);
  const msg=$("#feedback-message");msg.className="message";msg.textContent="Submitting...";
  try{
    const result=await api("/api/feedback",{method:"POST",body:JSON.stringify(data)});
    msg.className="message success";msg.textContent=`Thank you! Your feedback was submitted. Reference: ${result.id}`;
    form.reset();loadStats();
  }catch(err){msg.className="message error";msg.textContent=err.message}
});
async function loadFeedback(){
  try{
    const data=await api("/api/feedback");
    $("#history-count").textContent=`${data.items.length} submissions`;
    $("#feedback-history").innerHTML=data.items.length?data.items.map(item=>`
      <article class="history-card">
        <div class="history-top"><span class="tag">${escapeHTML(item.category)}</span><span class="history-meta">${new Date(item.created_at).toLocaleString()}</span></div>
        <h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description)}</p>
        <div class="history-meta"><span>${escapeHTML(item.id)}</span><span class="stars">${"★".repeat(item.rating)}${"☆".repeat(5-item.rating)}</span>${item.name?`<span>By ${escapeHTML(item.name)}</span>`:""}</div>
      </article>`).join(""):'<div class="panel empty">No feedback submitted yet. Be the first to share an idea!</div>';
  }catch(e){$("#feedback-history").innerHTML=`<div class="panel empty">${escapeHTML(e.message)}</div>`}
}
async function loadStats(){try{const data=await api("/api/feedback/stats");$("#feedback-count").textContent=data.total}catch(e){}}
loadTasks();loadStats();
