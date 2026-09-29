import { escapeHTML } from './views.js';

export function betweenChooserView(){
  return `<dialog id="betweenChooser" class="word-chooser" aria-labelledby="betweenChooserTitle">
    <div class="gathering-picker-head"><h2 id="betweenChooserTitle">Choose words</h2><button id="closeBetweenChooser" class="button-ghost">Close</button></div>
    <label for="betweenFilter" class="gathering-filter-label">Find exact words</label>
    <input id="betweenFilter" class="search-input" type="search" autocomplete="off" placeholder="Search your record">
    <p id="betweenResultCount" class="small" role="status"></p><div id="betweenChoices"></div>
    <button id="moreBetweenChoices" class="button-ghost" hidden>Show more</button>
  </dialog>`;
}

export function bindBetweenChooser(root,{getEntries,onChoose}){
  const dialog=root.querySelector('#betweenChooser'),filter=root.querySelector('#betweenFilter');
  let opener=null,limit=40;
  const render=()=>{
    const query=filter.value.toLocaleLowerCase();
    const matches=getEntries().filter(entry=>(entry.text??'').toLocaleLowerCase().includes(query));
    root.querySelector('#betweenResultCount').textContent=matches.length?`${matches.length} matching position${matches.length===1?'':'s'}`:'No words match. Try another search.';
    root.querySelector('#betweenChoices').innerHTML=matches.slice(0,limit).map(entry=>`<button class="word-choice" data-between-choice="${escapeHTML(entry.id)}"><span class="small">${escapeHTML(entry.temporal?.display||'Undated')}</span><span class="word-choice-text">${escapeHTML(entry.text??'[Artifact preserved]')}</span></button>`).join('');
    root.querySelector('#moreBetweenChoices').hidden=matches.length<=limit;
  };
  root.addEventListener('click',event=>{
    const trigger=event.target.closest('[data-between-slot]');
    if(trigger){opener=trigger;limit=40;filter.value='';root.querySelector('#betweenChooserTitle').textContent=trigger.dataset.betweenSlot==='A'?'Choose first position':'Choose second position';render();dialog.showModal();filter.focus();}
    if(event.target.closest('#closeBetweenChooser'))dialog.close();
    const choice=event.target.closest('[data-between-choice]');
    if(choice&&opener){onChoose(opener.dataset.betweenSlot,choice.dataset.betweenChoice);dialog.close();}
    if(event.target.closest('#moreBetweenChoices')){limit+=40;render();}
  });
  filter.addEventListener('input',()=>{limit=40;render();});
  dialog.addEventListener('close',()=>opener?.focus({preventScroll:true}));
  dialog.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const controls=[...dialog.querySelectorAll('button,input')].filter(el=>!el.hidden&&el.getClientRects().length);
    if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}
    else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}
  });
}
