(function(){
  "use strict";
  var KANJI=(window.JL_KANJI||[]).map(function(k){return Object.assign({},k,{frame:k.id,id:"kanji:"+k.id,progressId:"kanji:"+k.id,subject:"kanji",type:"kanji"})});
  var NOTES_KEY="japaneseLessons.kanjiNotes.v1";
  var notes=loadNotes(),drawIndex=0,strokes=[],drawing=false,traceOn=false,noteTimer=null;
  var selectedFrames=new Set(),selectionDrag=null;
  var quiz={scope:50,count:10,mode:"adaptive",cards:[],index:0,results:[],answered:false,currentMode:"meaning",retryRound:false,elapsedMs:0,activeSince:0};
  var lastSpaceAt=0;
  function $(s){return document.querySelector(s)}
  function $all(s){return Array.prototype.slice.call(document.querySelectorAll(s))}
  function loadNotes(){try{return JSON.parse(localStorage.getItem(NOTES_KEY))||{}}catch(_){return {}}}
  function saveNotes(){localStorage.setItem(NOTES_KEY,JSON.stringify(notes))}
  function saveNote(frame,value){var clean=String(value||"").trim();if(clean)notes[frame]=clean;else delete notes[frame];saveNotes()}
  function shuffle(list){var a=list.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
  function normalize(value){return String(value||"").toLowerCase().replace(/[^a-z0-9 ]+/g,"").replace(/\s+/g," ").trim()}
  function matches(card,value){var n=normalize(value),tight=n.replace(/ /g,"");return !!n&&card.answers.some(function(answer){var a=normalize(answer);return n===a||tight===a.replace(/ /g,"")})}
  function formatStudyTime(ms){
    if(!ms)return "0m";if(ms<60000)return Math.max(1,Math.round(ms/1000))+"s";var minutes=Math.floor(ms/60000);if(minutes<60)return minutes+"m";var hours=Math.floor(minutes/60),remainder=minutes%60;return hours+"h"+(remainder?" "+remainder+"m":"");
  }
  function pauseQuizTimer(){if(!quiz.activeSince)return;quiz.elapsedMs+=Date.now()-quiz.activeSince;quiz.activeSince=0}
  function resumeQuizTimer(){if(quiz.activeSince||document.visibilityState!=="visible"||!$("#view-quiz").classList.contains("active")||$("#quiz-question").hidden)return;quiz.activeSince=Date.now()}
  function color(id){
    var s=JL_PROGRESS.strength(id);if(!JL_PROGRESS.card(id).reviews)return "#ECE6DA";
    var hue=s<50?8+(38*s/50):46+(94*(s-50)/50);return "hsl("+Math.round(hue)+",55%,"+(67-Math.min(18,s*.18))+"%)";
  }
  function weakKanji(){
    return KANJI.filter(function(k){var state=JL_PROGRESS.card(k.progressId);return state.reviews&&(JL_PROGRESS.strength(k.progressId)<60||state.lastRating==="again")}).sort(function(a,b){
      var aState=JL_PROGRESS.card(a.progressId),bState=JL_PROGRESS.card(b.progressId),aScore=(100-JL_PROGRESS.strength(a.progressId))+aState.lapses*10+aState.again*3+(aState.lastRating==="again"?30:0),bScore=(100-JL_PROGRESS.strength(b.progressId))+bState.lapses*10+bState.again*3+(bState.lastRating==="again"?30:0);return bScore-aScore;
    });
  }
  function selectedKanji(){return KANJI.filter(function(k){return selectedFrames.has(k.frame)})}
  function setTileSelected(tile,selected){
    var frame=+tile.dataset.id;if(selected)selectedFrames.add(frame);else selectedFrames.delete(frame);tile.classList.toggle("selected",selected);tile.setAttribute("aria-pressed",selected?"true":"false");
  }
  function updateSelectionControls(){
    var count=selectedFrames.size,weak=weakKanji(),weakCount=Math.min(20,weak.length);$("#selection-count").textContent=count+" selected";$("#selection-copy").textContent=count?"Drag from a selected tile to remove a group.":"Weak = studied below 60% or missed last time.";$("#clear-selection").disabled=!count;$("#quiz-selection").disabled=!count;$("#quiz-selection").textContent=count?"Quiz selected ("+count+")":"Quiz selected";$("#quiz-weak").disabled=!weakCount;$("#quiz-weak").textContent=!weakCount?"No weak kanji yet":weak.length>20?"Quiz weakest 20":"Quiz weak ("+weakCount+")";$("#quiz-weak").title=weakCount?"Studied kanji below 60% strength or missed on their latest review":"Weak quizzes appear after you have reviewed kanji";
  }
  function showView(name){
    if(name!=="quiz")pauseQuizTimer();
    $all(".tab").forEach(function(tab){tab.classList.toggle("active",tab.dataset.view===name)});
    $all(".view").forEach(function(view){view.classList.toggle("active",view.id==="view-"+name)});
    if(name==="dashboard")renderDashboard();if(name==="draw")renderDraw();if(name==="quiz")setStage("quiz-setup");
  }
  $all(".tab").forEach(function(tab){tab.onclick=function(){showView(tab.dataset.view)}});
  function renderDashboard(){
    var ids=KANJI.map(function(k){return k.progressId}),s=JL_PROGRESS.summary(ids);
    $("#kanji-stats").innerHTML='<div class="stat"><strong>'+s.due+'</strong><span>due or new</span></div><div class="stat"><strong>'+s.studied+' / '+s.total+'</strong><span>studied</span></div><div class="stat"><strong>'+s.mastered+'</strong><span>mastered</span></div><div class="stat"><strong>'+s.accuracy+'%</strong><span>accuracy</span></div><div class="stat"><strong>'+formatStudyTime(JL_PROGRESS.studyTime("kanji"))+'</strong><span>kanji quiz time</span></div><div class="stat"><strong>'+s.streak+'</strong><span>day streak</span></div><div class="stat"><strong>Lv. '+s.level+'</strong><span>'+s.xp+' total XP</span></div>';
    $("#mastery").innerHTML=KANJI.map(function(k){var selected=selectedFrames.has(k.frame);return '<button class="tile'+(selected?' selected':'')+'" data-id="'+k.frame+'" data-next="'+JL_PROGRESS.nextLabel(k.progressId)+'" aria-pressed="'+selected+'" title="RTK #'+k.rtkFrame+' · '+k.meaning+' · '+JL_PROGRESS.strength(k.progressId)+'%" style="background:'+color(k.progressId)+'">'+k.kanji+'</button>'}).join("");updateSelectionControls();
  }
  function launchDashboardQuiz(cards){
    if(!cards.length)return;quiz.scope=250;quiz.count=cards.length;quiz.mode="adaptive";$all("#mode .seg-btn").forEach(function(button){button.classList.toggle("active",button.dataset.mode==="adaptive")});showView("quiz");startQuiz(cards);
  }
  var mastery=$("#mastery");
  function dragOverTile(tile){
    if(!selectionDrag||!tile||!mastery.contains(tile)||selectionDrag.seen[tile.dataset.id])return;selectionDrag.seen[tile.dataset.id]=true;setTileSelected(tile,selectionDrag.selecting);updateSelectionControls();
  }
  mastery.addEventListener("pointerdown",function(e){
    var tile=e.target.closest(".tile");if(!tile||e.button!==0)return;selectionDrag={pointerId:e.pointerId,pointerType:e.pointerType,selecting:!selectedFrames.has(+tile.dataset.id),seen:{},startTile:tile,startX:e.clientX,startY:e.clientY,moved:false};mastery.classList.add("selecting");mastery.setPointerCapture(e.pointerId);if(e.pointerType!=="touch")dragOverTile(tile);if(e.pointerType==="mouse")e.preventDefault();
  });
  mastery.addEventListener("pointermove",function(e){
    if(!selectionDrag||selectionDrag.pointerId!==e.pointerId)return;var dx=Math.abs(e.clientX-selectionDrag.startX),dy=Math.abs(e.clientY-selectionDrag.startY);if(e.pointerType==="touch"){if(!selectionDrag.moved&&dx>8&&dx>dy){selectionDrag.moved=true;dragOverTile(selectionDrag.startTile)}if(!selectionDrag.moved)return}else if(dx>5||dy>5)selectionDrag.moved=true;var target=document.elementFromPoint(e.clientX,e.clientY);dragOverTile(target&&target.closest(".tile"));if(selectionDrag.moved&&e.pointerType==="mouse")e.preventDefault();
  });
  function endSelectionDrag(e){if(!selectionDrag||selectionDrag.pointerId!==e.pointerId)return;if(selectionDrag.pointerType==="touch"&&!selectionDrag.moved&&e.type==="pointerup")dragOverTile(selectionDrag.startTile);selectionDrag=null;mastery.classList.remove("selecting")}
  mastery.addEventListener("pointerup",endSelectionDrag);mastery.addEventListener("pointercancel",endSelectionDrag);
  mastery.addEventListener("click",function(e){var tile=e.target.closest(".tile");if(!tile)return;e.preventDefault();if(e.detail===0){setTileSelected(tile,!selectedFrames.has(+tile.dataset.id));updateSelectionControls()}});
  mastery.addEventListener("dblclick",function(e){var tile=e.target.closest(".tile");if(!tile)return;drawIndex=+tile.dataset.id-1;showView("draw")});
  $("#clear-selection").onclick=function(){selectedFrames.clear();$all(".tile").forEach(function(tile){setTileSelected(tile,false)});updateSelectionControls()};
  $("#quiz-selection").onclick=function(){launchDashboardQuiz(shuffle(selectedKanji()))};
  $("#quiz-weak").onclick=function(){launchDashboardQuiz(weakKanji().slice(0,20))};
  $("#quick-review").onclick=function(){quiz.scope=250;quiz.count=10;quiz.mode="adaptive";$all("#mode .seg-btn").forEach(function(button){button.classList.toggle("active",button.dataset.mode==="adaptive")});showView("quiz");startQuiz()};
  $("#export-progress").onclick=function(){var blob=new Blob([JL_PROGRESS.exportData()],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="japanese-lessons-progress.json";a.click();URL.revokeObjectURL(a.href)};
  $("#reset-progress").onclick=function(){if(confirm("Reset progress for vocabulary, kanji, and every study mode?")){JL_PROGRESS.reset();notes={};saveNotes();renderDashboard()}};

  function buildPicker(){
    $("#picker").innerHTML=KANJI.map(function(k,i){return '<option value="'+i+'">RTK '+String(k.rtkFrame).padStart(4,"0")+' · '+k.kanji+' — '+k.meaning+'</option>'}).join("");
    $("#picker").onchange=function(){drawIndex=+this.value;renderDraw()};
  }
  function renderDraw(){
    var k=KANJI[drawIndex];if(!k)return;
    $("#picker").value=drawIndex;$("#frame").textContent="RTK frame "+k.rtkFrame+" · strength "+JL_PROGRESS.strength(k.progressId)+"% · next "+JL_PROGRESS.nextLabel(k.progressId);
    $("#meaning").textContent=k.meaning;$("#hint").textContent=k.hint?"primitive: "+k.hint:"";
    $("#revealed").textContent=k.kanji;$("#revealed").hidden=false;$("#reveal").textContent="Hide kanji";
    $("#notes").value=notes[k.frame]||"";strokes=[];resizeCanvas();
  }
  $("#prev").onclick=function(){drawIndex=(drawIndex+KANJI.length-1)%KANJI.length;renderDraw()};
  $("#next").onclick=function(){drawIndex=(drawIndex+1)%KANJI.length;renderDraw()};
  $("#random").onclick=function(){drawIndex=Math.floor(Math.random()*KANJI.length);renderDraw()};
  $("#reveal").onclick=function(){var el=$("#revealed");el.hidden=!el.hidden;this.textContent=el.hidden?"Reveal kanji":"Hide kanji"};
  $("#notes").oninput=function(){var value=this.value,id=KANJI[drawIndex].frame;clearTimeout(noteTimer);noteTimer=setTimeout(function(){saveNote(id,value)},350)};

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
  function setStage(id){["quiz-setup","quiz-question","quiz-results"].forEach(function(stage){$("#"+stage).hidden=stage!==id});if(id==="quiz-question")resumeQuizTimer();else pauseQuizTimer()}
  $("#start-quiz").onclick=function(){startQuiz()};
  function startQuiz(custom,retryRound){
    pauseQuizTimer();quiz.elapsedMs=0;quiz.activeSince=0;var pool=custom||JL_PROGRESS.order(KANJI.slice(0,quiz.scope));quiz.cards=custom?pool.slice():pool.slice(0,Math.min(quiz.count,pool.length));quiz.index=0;quiz.results=[];quiz.retryRound=!!retryRound;setStage("quiz-question");renderQuestion();
  }
  function renderQuestion(){
    var card=quiz.cards[quiz.index];if(!card){finishQuiz();return}quiz.answered=false;
    quiz.currentMode=quiz.mode==="adaptive"?(JL_PROGRESS.strength(card.progressId)>=55?"recognition":"meaning"):quiz.mode;
    $("#q-progress").textContent=(quiz.retryRound?"Retry · ":"")+(quiz.index+1)+" / "+quiz.cards.length;$("#q-mode").textContent=quiz.currentMode==="meaning"?"kanji → meaning":"meaning → kanji";$("#q-fill").style.width=(quiz.index/quiz.cards.length*100)+"%";$("#feedback").hidden=true;$("#memory-cue").hidden=true;$("#quiz-note-editor").hidden=true;$("#continue").hidden=false;$("#hint-tools").hidden=false;$("#question-hint").hidden=true;$("#show-hint").textContent="Hint";$("#show-hint").setAttribute("aria-expanded","false");lastSpaceAt=0;
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
    $("#meaning-input").disabled=true;$all(".choice").forEach(function(button){button.disabled=true;if(button.dataset.id===card.id)button.classList.add("right")});if(picked&&!correct)picked.classList.add("wrong");$("#hint-tools").hidden=true;
    var feedback=$("#feedback");feedback.className="feedback "+(correct?"good":"bad");$("#verdict").textContent=correct?"Correct!":"Not quite";$("#correct-answer").innerHTML='<span class="big">'+card.kanji+'</span> = <strong>'+card.meaning+"</strong>";$("#feedback-help").textContent=correct?"Press Enter to continue.":"Press Enter to continue, or double-tap Space to edit your note.";if(correct)$("#memory-cue").hidden=true;else renderMemoryCue(card);feedback.hidden=false;$("#q-fill").style.width=((quiz.index+1)/quiz.cards.length*100)+"%";setTimeout(function(){$("#continue").focus()},50);
  }
  function fillPrimitiveList(selector,parts){
    var list=$(selector);list.innerHTML="";
    if(parts.length)parts.forEach(function(part){var chip=document.createElement("span");chip.className="primitive";chip.textContent=part;list.appendChild(chip)});
    else{var chip=document.createElement("span");chip.className="primitive";chip.textContent="base character";list.appendChild(chip)}
  }
  function renderQuestionHint(card){
    var parts=card.primitives||[];$("#question-hint-meta").textContent="Remembering the Kanji 1 · RTK frame "+card.rtkFrame;fillPrimitiveList("#question-primitive-list",parts);
    $("#question-primitive-image").hidden=!card.hint;$("#question-primitive-image").textContent=card.hint?"Extra primitive image: "+card.hint:"";
    var existing=notes[card.frame]||"";$("#question-note-preview").hidden=!existing;$("#question-note-preview").textContent=existing?"Your note: "+existing:"";
  }
  $("#show-hint").onclick=function(){
    if(quiz.answered)return;var panel=$("#question-hint"),opening=panel.hidden;panel.hidden=!opening;this.textContent=opening?"Hide hint":"Hint";this.setAttribute("aria-expanded",opening?"true":"false");if(opening)renderQuestionHint(quiz.cards[quiz.index]);
  };
  function renderMemoryCue(card){
    $("#memory-cue").hidden=false;$("#rtk-meta").textContent="Remembering the Kanji 1 · RTK frame "+card.rtkFrame;
    var parts=card.primitives||[];
    fillPrimitiveList("#primitive-list",parts);
    $("#rtk-cue").textContent=(parts.length?parts.join(" + "):"base image")+" → "+card.rtkKeyword;
    $("#primitive-image").hidden=!card.hint;$("#primitive-image").textContent=card.hint?"Extra primitive image: "+card.hint:"";
    var existing=notes[card.frame]||"";$("#note-preview").hidden=!existing;$("#note-preview").textContent=existing?"Your note: "+existing:"";$("#quiz-note").value=existing;$("#quiz-note-editor").hidden=true;
  }
  function openQuizNoteEditor(){
    if(!quiz.answered||!$("#feedback").classList.contains("bad"))return;var card=quiz.cards[quiz.index];$("#quiz-note").value=notes[card.frame]||"";$("#quiz-note-editor").hidden=false;$("#continue").hidden=true;$("#feedback-help").textContent="Enter saves your note and moves to the next kanji.";setTimeout(function(){$("#quiz-note").focus();$("#quiz-note").setSelectionRange($("#quiz-note").value.length,$("#quiz-note").value.length)},20);
  }
  function advanceQuestion(){
    if(!$("#quiz-note-editor").hidden){var card=quiz.cards[quiz.index];saveNote(card.frame,$("#quiz-note").value)}quiz.index++;renderQuestion();
  }
  $("#continue").onclick=advanceQuestion;$("#save-note-continue").onclick=advanceQuestion;
  $("#quiz-note").addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();advanceQuestion()}});
  function finishQuiz(){
    pauseQuizTimer();setStage("quiz-results");var correct=quiz.results.filter(function(r){return r.correct}).length,total=quiz.results.length,missed=quiz.results.filter(function(r){return !r.correct});
    JL_PROGRESS.addSession({kind:"kanji",total:total,correct:correct,mode:quiz.mode,retry:quiz.retryRound,durationMs:Math.round(quiz.elapsedMs)});$("#score").textContent=correct+" / "+total;
    if(quiz.retryRound)$("#result-copy").textContent=missed.length?"Retry round complete. Anything still missed stays scheduled for earlier adaptive review.":"Retry round complete. You recovered every missed kanji.";
    else $("#result-copy").textContent=missed.length?"Practice every missed kanji once more, or let the adaptive queue bring them back.":"Perfect run. These characters are now spaced farther out.";
    $("#missed").innerHTML=missed.map(function(r){return '<div class="missed-row"><b>'+r.card.kanji+'</b><span>'+r.card.meaning+"</span></div>"}).join("");$("#retry").hidden=!missed.length||quiz.retryRound;$("#retry").onclick=function(){startQuiz(missed.map(function(r){return r.card}),true)};
  }
  $("#new-quiz").onclick=function(){setStage("quiz-setup")};$("#to-dashboard").onclick=function(){showView("dashboard")};
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")resumeQuizTimer();else pauseQuizTimer()});
  document.addEventListener("keydown",function(e){
    if($("#quiz-question").hidden)return;
    if(quiz.answered){
      if(!$("#quiz-note-editor").hidden)return;
      if(e.code==="Space"&&$("#feedback").classList.contains("bad")){e.preventDefault();var now=Date.now();if(lastSpaceAt&&now-lastSpaceAt<450){lastSpaceAt=0;openQuizNoteEditor()}else lastSpaceAt=now;return}
      if(e.key==="Enter"){e.preventDefault();advanceQuestion()}return;
    }
    if(quiz.currentMode!=="recognition")return;var n=+e.key;if(n>=1&&n<=8){var button=$all(".choice")[n-1];if(button)button.click()}
  });
  buildPicker();renderDashboard();
})();
