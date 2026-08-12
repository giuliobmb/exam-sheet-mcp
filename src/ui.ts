/**
 * Returns the self-contained HTML for the exam sheet.
 *
 * It runs inside a sandboxed iframe, connects to the host via the ext-apps
 * `App` class, fetches the exam with the `get_exam` tool, grades objective
 * questions locally, and delegates open-question grading to `grade_answer`.
 *
 * NOTE: keep the esm.sh version of `@modelcontextprotocol/ext-apps` aligned
 * with the version in package.json.
 */
export function examAppHtml(): string {
  return String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Exam Sheet</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=Courier+Prime:wght@400;700&display=swap');
:root{--paper:#dfe6e8;--line:#aebcc1;--ink:#1c2a40;--ink-soft:#4d5c72;--pen-red:#a13a2c;--pen-green:#2c6b4f;--stamp:#4a3d6b;}
*{box-sizing:border-box;}
body{font-family:'Source Serif 4',serif;color:var(--ink);margin:0;background:var(--paper);
  background-image:repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(28,42,64,0.05) 28px);
  padding:28px 14px 48px;}
.sheet{max-width:640px;margin:0 auto;background:#f2efe4;border:1px solid var(--line);
  box-shadow:0 2px 0 var(--line),0 18px 40px -20px rgba(28,42,64,0.45);transform:rotate(-0.25deg);
  padding:28px 22px 32px;}
@media(min-width:640px){.sheet{padding:36px 46px 44px;}}
.topbar{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);
  padding-bottom:12px;margin-bottom:18px;gap:12px;flex-wrap:wrap;}
.meta{font-family:'Courier Prime',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);}
.timer{font-family:'Courier Prime',monospace;font-weight:700;font-size:20px;display:flex;align-items:center;gap:7px;
  color:var(--ink);padding:4px 10px;border:1.5px solid var(--ink);}
.timer.low{color:var(--pen-red);border-color:var(--pen-red);animation:pulse 1s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.55;}}
.title{font-family:'Fraunces',serif;font-weight:600;font-size:29px;line-height:1.15;margin:0 0 6px;}
.sub{color:var(--ink-soft);font-size:15px;margin:0 0 24px;}
.progress{font-family:'Courier Prime',monospace;font-size:12px;color:var(--ink-soft);display:flex;justify-content:space-between;margin-bottom:8px;}
.bar{height:3px;background:var(--line);margin-bottom:26px;}
.bar-fill{height:100%;background:var(--stamp);transition:width .3s ease;}
.question{font-family:'Fraunces',serif;font-weight:500;font-size:22px;line-height:1.35;margin:0 0 24px;}
.opt-list{display:flex;flex-direction:column;gap:10px;margin-bottom:20px;}
.opt{text-align:left;font-family:'Source Serif 4',serif;font-size:15.5px;background:transparent;border:1.5px solid var(--ink-soft);
  color:var(--ink);padding:12px 16px;cursor:pointer;display:flex;align-items:center;gap:12px;}
.opt:hover:not(:disabled){border-color:var(--ink);background:rgba(28,42,64,.04);}
.opt.correct{border-color:var(--pen-green);background:rgba(44,107,79,.1);color:var(--pen-green);}
.opt.wrong{border-color:var(--pen-red);background:rgba(161,58,44,.08);color:var(--pen-red);}
.opt:disabled{cursor:default;}
.opt-letter{font-family:'Courier Prime',monospace;font-size:12px;border:1px solid currentColor;width:22px;height:22px;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.tf-row{display:flex;gap:12px;margin-bottom:20px;}
.tf-btn{flex:1;font-family:'Fraunces',serif;font-size:17px;padding:18px;border:1.5px solid var(--ink-soft);
  background:transparent;color:var(--ink);cursor:pointer;}
.tf-btn:hover:not(:disabled){border-color:var(--ink);}
.tf-btn.correct{border-color:var(--pen-green);background:rgba(44,107,79,.1);color:var(--pen-green);}
.tf-btn.wrong{border-color:var(--pen-red);background:rgba(161,58,44,.08);color:var(--pen-red);}
.tf-btn:disabled{cursor:default;opacity:.55;}
.textarea{width:100%;min-height:110px;font-family:'Source Serif 4',serif;font-size:15.5px;background:rgba(28,42,64,.03);
  border:1.5px solid var(--ink-soft);padding:12px 14px;resize:vertical;outline:none;margin-bottom:16px;}
.textarea:focus{border-color:var(--stamp);}
.btn{font-family:'Courier Prime',monospace;font-size:14px;letter-spacing:.04em;text-transform:uppercase;background:var(--ink);
  color:#f2efe4;border:none;padding:13px 24px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;}
.btn:hover{background:var(--stamp);}
.btn:disabled{opacity:.4;cursor:not-allowed;}
.btn-ghost{background:transparent;color:var(--ink);border:1.5px solid var(--ink);}
.btn-ghost:hover{background:var(--ink);color:#f2efe4;}
.row-end{display:flex;justify-content:flex-end;margin-top:4px;}
.feedback{border-left:3px solid var(--pen-red);padding:10px 14px;margin-bottom:20px;font-size:14.5px;color:var(--ink-soft);background:rgba(161,58,44,.05);}
.feedback.good{border-color:var(--pen-green);background:rgba(44,107,79,.06);}
.feedback-head{font-family:'Courier Prime',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;color:var(--ink);}
.stamp-wrap{display:flex;justify-content:center;margin:8px 0 28px;}
.stamp{width:148px;height:148px;border-radius:50%;border:3px double var(--stamp);color:var(--stamp);display:flex;
  flex-direction:column;align-items:center;justify-content:center;transform:rotate(-9deg);
  background:repeating-radial-gradient(circle at 50% 50%,rgba(74,61,107,.05) 0 2px,transparent 2px 4px);
  animation:stamp-down .45s cubic-bezier(.2,1.4,.4,1);}
@keyframes stamp-down{0%{transform:rotate(-9deg) scale(2.4);opacity:0;}70%{opacity:1;}100%{transform:rotate(-9deg) scale(1);opacity:1;}}
.stamp-grade{font-family:'Fraunces',serif;font-weight:700;font-size:40px;line-height:1;}
.stamp-label{font-family:'Courier Prime',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-top:4px;}
.review{border-top:1px solid var(--line);padding:14px 0;font-size:14.5px;}
.review-detail{color:var(--ink-soft);margin:6px 0 0 4px;font-size:13.5px;}
.center{display:flex;justify-content:center;margin-top:26px;}
.state{color:var(--ink-soft);text-align:center;padding:50px 10px;font-size:15px;}
.timeout{color:var(--pen-red);font-family:'Courier Prime',monospace;font-size:13px;text-transform:uppercase;letter-spacing:.05em;text-align:center;margin-bottom:16px;}
@media(prefers-reduced-motion:reduce){.stamp,.timer.low{animation:none;}}
</style>
</head>
<body>
<div class="sheet" id="root"><div class="state">Loading exam…</div></div>

<script type="module">
import { App } from 'https://esm.sh/@modelcontextprotocol/ext-apps';

const TYPE_LABELS = { tf: 'True or False', mc: 'Multiple choice', open: 'Open question' };
const root = document.getElementById('root');

let exam = null;        // { id, topic, timeLimitSeconds, questions:[{type,question,options?}] }
let answerKey = [];     // ['True'|'False' | number | null]
let answers = [];       // [{ chosen, correct, score, feedback, revealed }]
let index = 0;
let secondsLeft = null;
let timedOut = false;
let app = null;

function fmt(s){s=Math.max(0,Math.floor(s));const m=Math.floor(s/60),x=s%60;return String(m).padStart(2,'0')+':'+String(x).padStart(2,'0');}
function computeGrade(p){if(p<60)return{grade:null,passed:false,honors:false};return{grade:p,passed:true,honors:p>=97};}
function esc(t){const d=document.createElement('div');d.textContent=t==null?'':String(t);return d.innerHTML;}

async function getToolData(result){
  if(!result) return null;
  if(result.structuredContent) return result.structuredContent;
  const textBlock=(result.content||[]).find(c=>c.type==='text');
  if(textBlock){try{return JSON.parse(textBlock.text);}catch{return null;}}
  return null;
}

async function boot(){
  try{
    app = new App({ name:'exam-sheet', version:'1.0.0' });
    await app.connect();
    const res = await app.callServerTool('get_exam', {});
    const data = await getToolData(res);
    if(!data || !data.exam) throw new Error('No exam data received.');
    exam = data.exam;
    answerKey = data.answerKey || [];
    answers = exam.questions.map(()=>({chosen:null,correct:null,score:null,feedback:null,revealed:false}));
    secondsLeft = exam.timeLimitSeconds;
    if(secondsLeft!=null) startTimer();
    render();
  }catch(err){
    root.innerHTML = '<div class="state">Could not load the exam.<br><small>'+esc(err.message||err)+'</small></div>';
  }
}

let timerId=null;
function startTimer(){
  timerId=setInterval(()=>{
    secondsLeft--;
    if(secondsLeft<=0){secondsLeft=0;clearInterval(timerId);timedOut=true;finish();return;}
    const el=document.getElementById('timer');
    if(el){el.textContent=fmt(secondsLeft);el.classList.toggle('low',secondsLeft<=300);}
  },1000);
}

function answeredCount(){return answers.filter(a=>a.revealed).length;}
function finished(){return index>=exam.questions.length;}
let done=false;
function finish(){done=true;if(timerId)clearInterval(timerId);render();}

function render(){
  if(done) return renderResults();
  const q=exam.questions[index];
  const a=answers[index];
  const pct=((index+(a.revealed?1:0))/exam.questions.length)*100;
  root.innerHTML =
    '<div class="topbar"><span class="meta">'+esc(exam.topic)+'</span>'+
    (exam.timeLimitSeconds!=null?'<span class="timer'+(secondsLeft<=300?' low':'')+'" id="timer">'+fmt(secondsLeft)+'</span>':'')+
    '</div>'+
    '<div class="progress"><span>Question '+(index+1)+' of '+exam.questions.length+'</span><span>'+TYPE_LABELS[q.type]+'</span></div>'+
    '<div class="bar"><div class="bar-fill" style="width:'+pct+'%"></div></div>'+
    '<h2 class="question">'+esc(q.question)+'</h2>'+
    renderBody(q,a)+
    (a.revealed?renderFeedback(q,a):'')+
    (a.revealed?'<div class="row-end"><button class="btn" id="next">'+(index+1<exam.questions.length?'Next question':'Submit exam')+' →</button></div>':'');
  wire(q,a);
}

function renderBody(q,a){
  if(q.type==='tf'){
    return '<div class="tf-row">'+['True','False'].map(o=>{
      let cls='';if(a.revealed){cls=o===answerKey[index]?'correct':(a.chosen===o?'wrong':'');}
      return '<button class="tf-btn '+cls+'" data-tf="'+o+'"'+(a.revealed?' disabled':'')+'>'+o+'</button>';
    }).join('')+'</div>';
  }
  if(q.type==='mc'){
    return '<div class="opt-list">'+(q.options||[]).map((o,i)=>{
      let cls='';if(a.revealed){if(i===answerKey[index])cls='correct';else if(a.chosen===i)cls='wrong';}
      return '<button class="opt '+cls+'" data-mc="'+i+'"'+(a.revealed?' disabled':'')+'><span class="opt-letter">'+String.fromCharCode(65+i)+'</span>'+esc(o)+'</button>';
    }).join('')+'</div>';
  }
  return '<textarea class="textarea" id="open" placeholder="Write your answer…"'+(a.revealed?' disabled':'')+'>'+esc(a.revealed?a.chosen:'')+'</textarea>'+
    (a.revealed?'':'<div class="row-end"><button class="btn" id="submitOpen">Submit answer</button></div>');
}

function renderFeedback(q,a){
  const good=a.correct;
  let body='';
  if(q.type==='open'){body=esc(a.feedback||'');}
  else if(!good){body='Correct answer: '+esc(q.type==='mc'?q.options[answerKey[index]]:answerKey[index]);}
  const head=q.type==='open'?('Score: '+a.score+'/100'):(good?'Correct':'Incorrect');
  return '<div class="feedback'+(good?' good':'')+'"><div class="feedback-head">'+head+'</div>'+body+
    (q.explanation?'<div style="margin-top:6px">'+esc(q.explanation)+'</div>':'')+'</div>';
}

function wire(q,a){
  const next=document.getElementById('next');
  if(next)next.onclick=()=>{if(index+1<exam.questions.length){index++;}else{return finish();}render();};
  if(a.revealed)return;
  if(q.type==='tf'){root.querySelectorAll('[data-tf]').forEach(b=>b.onclick=()=>gradeObjective(b.dataset.tf));}
  if(q.type==='mc'){root.querySelectorAll('[data-mc]').forEach(b=>b.onclick=()=>gradeObjective(Number(b.dataset.mc)));}
  if(q.type==='open'){const s=document.getElementById('submitOpen');if(s)s.onclick=submitOpen;}
}

function gradeObjective(chosen){
  const correct=chosen===answerKey[index];
  answers[index]={chosen,correct,score:correct?100:0,feedback:null,revealed:true};
  render();
}

async function submitOpen(){
  const ta=document.getElementById('open');
  const text=(ta.value||'').trim();
  if(!text)return;
  const btn=document.getElementById('submitOpen');
  if(btn){btn.disabled=true;btn.textContent='Grading…';}
  try{
    const res=await app.callServerTool('grade_answer',{questionIndex:index,studentAnswer:text});
    const data=await getToolData(res)||{score:0,feedback:'Grading unavailable.'};
    answers[index]={chosen:text,correct:data.score>=60,score:data.score,feedback:data.feedback,revealed:true};
  }catch(err){
    answers[index]={chosen:text,correct:null,score:0,feedback:'Grading unavailable. Continue to the next question.',revealed:true};
  }
  render();
}

function renderResults(){
  const scores=answers.map(a=>a.revealed?a.score:0);
  const percent=Math.round(scores.reduce((s,v)=>s+(v||0),0)/scores.length);
  const {grade,passed,honors}=computeGrade(percent);
  root.innerHTML=
    '<h1 class="title">Exam report</h1>'+
    '<p class="sub">'+esc(exam.topic)+' — '+exam.questions.length+' questions · '+answeredCount()+' answered</p>'+
    (timedOut?'<div class="timeout">Time is up — exam submitted automatically</div>':'')+
    '<div class="stamp-wrap"><div class="stamp"><span class="stamp-grade">'+(grade!=null?grade:'—')+'</span>'+
    '<span class="stamp-label">'+(passed?(honors?'Passed — Honors':'Passed'):'Not passed')+'</span></div></div>'+
    exam.questions.map((q,i)=>{
      const a=answers[i];
      const mark=!a.revealed?'○':(a.correct?'✓':'✗');
      const extra=q.type==='open'&&a.revealed?(' — '+a.score+'/100'):(!a.revealed?' — blank':'');
      return '<div class="review"><strong>'+mark+'</strong> '+(i+1)+'. '+esc(q.question)+extra+
        (q.type==='open'&&a.feedback?'<div class="review-detail">'+esc(a.feedback)+'</div>':'')+'</div>';
    }).join('')+
    '<div class="center"><button class="btn btn-ghost" id="again">↻ New exam</button></div>';
  const again=document.getElementById('again');
  if(again)again.onclick=()=>{
    if(app&&app.sendMessage){app.sendMessage('Generate another exam.');}
  };
}

boot();
</script>
</body>
</html>`;
}
