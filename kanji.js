(function(){
  "use strict";
  var KANJI=(window.JL_KANJI||[]).map(function(k){return Object.assign({},k,{frame:k.id,id:"kanji:"+k.id,progressId:"kanji:"+k.id,subject:"kanji",type:"kanji"})});
  var NOTES_KEY="japaneseLessons.kanjiNotes.v1";
  var notes=loadNotes(),drawIndex=0,strokes=[],drawing=false,traceOn=false,noteTimer=null;
  var quiz={scope:50,count:10,mode:"adaptive",cards:[],index:0,results:[],answered:false,currentMode:"meaning"};
  function $(s){return document.querySelector(s)}
  function $all(s){return Array.prototype.slice.call(document.querySelectorAll(s))}
  function loadNotes(){try{return JSON.parse(localStorage.getItem(NOTES_KEY))||{}}catch(_){return {}}}
  function saveNotes(){localStorage.setItem(NOTES_KEY,JSON.stringify(notes))}
  function shuffle(list){var a=list.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
  function normalize(value){return String(value||"").toLowerCase().replace(/[^a-z0-9 ]+/g,"").replace(/\s+/g," ").trim()}
  function matches(card,value){var n=normalize(value),tight=n.replace(/ /g,"");return !!n&&card.answers.some(function(answer){var a=normalize(answer);return n===a||tight===a.replace(/ /g,"")})}
  function color(id){
    var s=JL_PROGRESS.strength(id);if(!JL_PROGRESS.card(id).reviews)return "#ECE6DA";
    var hue=s<50?8+(38*s/50):46+(94*(s-50)/50);return "hsl("+Math.round(hue)+",55%,"+(67-Math.min(18,s*.18))+"%)";
  }
  function showView(name){
    $all(".tab").forEach(function(tab){tab.classList.toggle("active",tab.dataset.view===name)});
    $all(".view").forEach(function(view){view.classList.toggle("active",view.id==="view-"+name)});
    if(name==="dashboard")renderDashboard();if(name==="draw")renderDraw();if(name==="quiz")setStage("quiz-setup");
  }
  $all(".tab").forEach(function(tab){tab.onclick=function(){showView(tab.dataset.view)}});
  function renderDashboard(){
    var ids=KANJI.map(function(k){return k.progressId}),s=JL_PROGRESS.summary(ids);
    $("#kanji-stats").innerHTML='<div class="stat"><strong>'+s.due+'</strong><span>due or new</span></div><div class="stat"><strong>'+s.studied+' / '+s.total+'</strong><span>studied</span></div><div class="stat"><strong>'+s.mastered+'</strong><span>mastered</span></div><div class="stat"><strong>'+s.accuracy+'%</strong><span>accuracy</span></div><div class="stat"><strong>'+s.streak+'</strong><span>day streak</span></div><div class="stat"><strong>Lv. '+s.level+'</strong><span>'+s.xp+' total XP</span></div>';
    $("#mastery").innerHTML=KANJI.map(function(k){return '<button class="tile" data-id="'+k.frame+'" data-next="'+JL_PROGRESS.nextLabel(k.progressId)+'" title="#'+k.frame+' '+k.meaning+' · '+JL_PROGRESS.strength(k.progressId)+'%" style="background:'+color(k.progressId)+'">'+k.kanji+'</button>'}).join("");
    $all(".tile").forEach(function(tile){tile.onclick=function(){drawIndex=+tile.dataset.id-1;showView("draw")}});
  }
  $("#quick-review").onclick=function(){quiz.scope=250;quiz.count=10;quiz.mode="adaptive";showView("quiz");startQuiz()};
  $("#export-progress").onclick=function(){var blob=new Blob([JL_PROGRESS.exportData()],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="japanese-lessons-progress.json";a.click();URL.revokeObjectURL(a.href)};
  $("#reset-progress").onclick=function(){if(confirm("Reset progress for vocabulary, kanji, and every study mode?")){JL_PROGRESS.reset();notes={};saveNotes();renderDashboard()}};

  function buildPicker(){
    $("#picker").innerHTML=KANJI.map(function(k,i){return '<option value="'+i+'">'+String(k.frame).padStart(4,"0")+' '+k.kanji+' — '+k.meaning+'</option>'}).join("");
    $("#picker").onchange=function(){drawIndex=+this.value;renderDraw()};
  }
  function renderDraw(){
    var k=KANJI[drawIndex];if(!k)return;
    $("#picker").value=drawIndex;$("#frame").textContent="#"+String(k.frame).padStart(4,"0")+" · strength "+JL_PROGRESS.strength(k.progressId)+"% · next "+JL_PROGRESS.nextLabel(k.progressId);
    $("#meaning").textContent=k.meaning;$("#hint").textContent=k.hint?"primitive: "+k.hint:"";
    $("#revealed").textContent=k.kanji;$("#revealed").hidden=true;$("#reveal").textContent="Reveal kanji";
    $("#notes").value=notes[k.frame]||"";strokes=[];resizeCanvas();
  }
  $("#prev").onclick=function(){drawIndex=(drawIndex+KANJI.length-1)%KANJI.length;renderDraw()};
  $("#next").onclick=function(){drawIndex=(drawIndex+1)%KANJI.length;renderDraw()};
  $("#random").onclick=function(){drawIndex=Math.floor(Math.random()*KANJI.length);renderDraw()};
  $("#reveal").onclick=function(){var el=$("#revealed");el.hidden=!el.hidden;this.textContent=el.hidden?"Reveal kanji":"Hide kanji"};
  $("#notes").oninput=function(){var value=this.value,id=KANJI[drawIndex].frame;clearTimeout(noteTimer);noteTimer=setTimeout(function(){if(value.trim())notes[id]=value;else delete notes[id];saveNotes()},350)};

  var canvas=$("#canvas"),ctx=canvas.getContext("2d"),canvasWrap=$("#canvas-wrap");
  function canvasSize(){return canvasWrap.getBoundingClientRect().width}
  function resizeCanvas(){var size=canvasSize();if(!size)return;var dpr=window.devicePixelRatio||1;canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);redraw()}
  function redraw(){
    var size=canvasSize();ctx.clearRect(0,0,size,size);ctx.save();ctx.strokeStyle="rgba(194,66,58,.2)";ctx.setLineDash([6,6]);ctx.beginPath();ctx.moveTo(size/2,8);ctx.lineTo(size/2,size-8);ctx.moveTo(8,size/2);ctx.lineTo(size-8,size/2);ctx.stroke();ctx.restore();
    if(traceOn){ctx.save();ctx.fillStyle="rgba(41,37,31,.09)";ctx.font=size*.8+'px "Zen Antique",serif';ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(KANJI[drawIndex].kanji,size/2,size*.54);ctx.restore()}
    ctx.strokeStyle="#29251F";ctx.lineWidth=Math.max(5,size*.02);ctx.lineCap="round";ctx.lineJoin="round";
    strokes.forEach(function(stroke){if(stroke.length<2)return;ctx.beginPath();ctx.moveTo(stroke[0][0]*size,stroke[0][1]*size);for(var i=1;i<stroke.length;i++)ctx.lineTo(stroke[i][0]*size,stroke[i][1]*size);ctx.stroke()});
  }
  canvas.onpointerdown=function(e){e.preventDefault();drawing=true;canvas.setPointerCapture(e.pointerId);var r=canvas.getBoundingClientRect();strokes.push([[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height]]);redraw()};
  canvas.onpointermove=function(e){if(!drawing)return;var r=canvas.getBoundingClientRect(),stroke=strokes[strokes.length-1];stroke.push([(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height]);redraw()};
  canvas.onpointerup=canvas.onpointercancel=function(){drawing=false};
  $("#undo").onclick=function(){strokes.pop();redraw()};$("#clear").onclick=function(){strokes=[];redraw()};$("#trace").onclick=function(){traceOn=!traceOn;this.setAttribute("aria-pressed",traceOn);redraw()};
  new ResizeObserver(function(){if($("#view-draw").classList.contains("active"))resizeCanvas()}).observe(canvasWrap);

  function bindSeg(id,key){
    $(id).onclick=function(e){var button=e.target.closest("[data-"+key+"]");if(!button)return;$all(id+" .seg-btn").forEach(function(b){b.classList.toggle("active",b===button)});quiz[key]=isNaN(+button.dataset[key])?button.dataset[key]:+button.dataset[key]};
  }
  bindSeg("#scope","scope");bindSeg("#count","count");bindSeg("#mode","mode");
  function setStage(id){["quiz-setup","quiz-question","quiz-results"].forEach(function(stage){$("#"+stage).hidden=stage!==id})}
  $("#start-quiz").onclick=function(){startQuiz()};
  function startQuiz(custom){
    var pool=custom||JL_PROGRESS.order(KANJI.slice(0,quiz.scope));quiz.cards=pool.slice(0,Math.min(quiz.count,pool.length));quiz.index=0;quiz.results=[];setStage("quiz-question");renderQuestion();
  }
  function renderQuestion(){
    var card=quiz.cards[quiz.index];if(!card){finishQuiz();return}quiz.answered=false;
    quiz.currentMode=quiz.mode==="adaptive"?(JL_PROGRESS.strength(card.progressId)>=55?"recognition":"meaning"):quiz.mode;
    $("#q-progress").textContent=(quiz.index+1)+" / "+quiz.cards.length;$("#q-mode").textContent=quiz.currentMode==="meaning"?"kanji → meaning":"meaning → kanji";$("#q-fill").style.width=(quiz.index/quiz.cards.length*100)+"%";$("#feedback").hidden=true;
    var meaning=quiz.currentMode==="meaning";$("#meaning-question").hidden=!meaning;$("#recognition-question").hidden=meaning;
    if(meaning){$("#q-kanji").textContent=card.kanji;$("#meaning-input").value="";$("#meaning-input").disabled=false;setTimeout(function(){$("#meaning-input").focus()},50)}
    else{$("#q-keyword").textContent=card.meaning;buildChoices(card)}
  }
  function buildChoices(card){
    var distractors=shuffle(KANJI.filter(function(k){return k.id!==card.id})).slice(0,7),options=shuffle([card].concat(distractors));
    $("#choices").innerHTML=options.map(function(k){return '<button class="choice" data-id="'+k.id+'">'+k.kanji+'</button>'}).join("");
    $all(".choice").forEach(function(button){button.onclick=function(){submit(button.dataset.id===card.id,button)}});
  }
  $("#meaning-form").onsubmit=function(e){e.preventDefault();if(!quiz.answered)submit(matches(quiz.cards[quiz.index],$("#meaning-input").value))};
  function submit(correct,picked){
    if(quiz.answered)return;quiz.answered=true;var card=quiz.cards[quiz.index],rating=correct?"good":"again";
    JL_PROGRESS.record(card.progressId,rating,{subject:"kanji",type:"kanji"});quiz.results.push({card:card,correct:correct});
    $("#meaning-input").disabled=true;$all(".choice").forEach(function(button){button.disabled=true;if(button.dataset.id===card.id)button.classList.add("right")});if(picked&&!correct)picked.classList.add("wrong");
    var feedback=$("#feedback");feedback.className="feedback "+(correct?"good":"bad");$("#verdict").textContent=correct?"Correct!":"Not quite";$("#correct-answer").innerHTML='<span class="big">'+card.kanji+'</span> = <strong>'+card.meaning+"</strong>"+(card.hint?" · "+card.hint:"");feedback.hidden=false;$("#q-fill").style.width=((quiz.index+1)/quiz.cards.length*100)+"%";setTimeout(function(){$("#continue").focus()},50);
  }
  $("#continue").onclick=function(){quiz.index++;renderQuestion()};
  function finishQuiz(){
    setStage("quiz-results");var correct=quiz.results.filter(function(r){return r.correct}).length,total=quiz.results.length,missed=quiz.results.filter(function(r){return !r.correct});
    JL_PROGRESS.addSession({kind:"kanji",total:total,correct:correct,mode:quiz.mode});$("#score").textContent=correct+" / "+total;$("#result-copy").textContent=missed.length?"Missed characters were scheduled sooner. Retry them now or let the adaptive queue bring them back.":"Perfect run. These characters are now spaced farther out.";
    $("#missed").innerHTML=missed.map(function(r){return '<div class="missed-row"><b>'+r.card.kanji+'</b><span>'+r.card.meaning+"</span></div>"}).join("");$("#retry").hidden=!missed.length;$("#retry").onclick=function(){startQuiz(missed.map(function(r){return r.card}))};
  }
  $("#new-quiz").onclick=function(){setStage("quiz-setup")};$("#to-dashboard").onclick=function(){showView("dashboard")};
  document.addEventListener("keydown",function(e){if($("#quiz-question").hidden||quiz.answered||quiz.currentMode!=="recognition")return;var n=+e.key;if(n>=1&&n<=8){var button=$all(".choice")[n-1];if(button)button.click()}});
  buildPicker();renderDashboard();
})();
