'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('cover reflection retains artwork source when the tile is cloned',()=>{
  class Element {
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={removeProperty(){}};this.classList={toggle(){},add(){},remove(){}};}
    append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}
    setAttribute(){}addEventListener(){}
    cloneNode(deep){const copy=new Element(this.tagName);copy.src=this.src;copy.alt=this.alt;if(deep)copy.children=this.children.map(child=>child.cloneNode(true));return copy;}
  }
  const track=new Element('div');
  const context=vm.createContext({window:{electronAPI:{},addEventListener(){},matchMedia(){return {matches:true};}},document:{getElementById(id){return id==='carousel-track'?track:{};},createElement(tag){return new Element(tag);}},requestAnimationFrame(){},navigator:{}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'renderer.js'),'utf8')+'\nupdateCarouselPositions=()=>{};gamesList=[{id:"cover",title:"Game",cover_art_path:"kratos-art://cover/cover",uses_fallback_art:false}];renderCarousel();',context);
  const [face,reflection]=track.children[0].children;
  assert.equal(face.children[0].src,'kratos-art://cover/cover');assert.equal(reflection.children[0].src,face.children[0].src);
});
test('admin chord suppresses game launch and navigation; A triggers only on press', () => {
  const actions=[];
  const context=vm.createContext({ window:{ electronAPI:{}, addEventListener(){} }, document:{getElementById(){return {}; }}, requestAnimationFrame(){}, navigator:{} });
  const source=fs.readFileSync(path.join(__dirname,'renderer.js'),'utf8');
  vm.runInContext(source + '\ninput = action => actions.push(action); openPin = () => actions.push("admin"); globalThis.engine = new GamepadWheelController();',context);
  context.actions=actions;
  const gp={buttons:Array.from({length:16},()=>({pressed:false})),axes:[0,0]};
  gp.buttons[4].pressed=gp.buttons[5].pressed=gp.buttons[12].pressed=gp.buttons[0].pressed=true;
  context.engine.handleInput(gp,1000);
  context.engine.handleInput(gp,1300);
  assert.deepEqual(actions,['admin']);
  gp.buttons.forEach(button=>button.pressed=false);
  context.engine.handleInput(gp,1400);
  gp.buttons[0].pressed=true;
  context.engine.handleInput(gp,1500);
  context.engine.handleInput(gp,1800);
  assert.deepEqual(actions,['admin','a']);
});
test('native field editing preserves cursor and Tab; Enter accepts and Escape discards', () => {
  const actions=[], listeners={};
  const context=vm.createContext({ actions, window:{electronAPI:{},addEventListener(name,callback){listeners[name]=callback;}},document:{getElementById(){return {};}},requestAnimationFrame(){},navigator:{} });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'renderer.js'),'utf8') + '\nmode="keyboard"; finishEdit=()=>actions.push("done"); cancelEdit=()=>actions.push("cancel"); input=action=>actions.push(action);',context);
  const dispatch=(key,target='INPUT',extra={})=>{let prevented=false;listeners.keydown({key,target:{tagName:target},preventDefault(){prevented=true;},...extra});return prevented;};
  assert.equal(dispatch('ArrowLeft'),false);
  assert.equal(dispatch('Tab'),false);
  assert.equal(dispatch('v','INPUT',{ctrlKey:true}),false);
  assert.deepEqual(actions,[]);
  assert.equal(dispatch('Enter'),true);
  assert.equal(dispatch('Escape'),true);
  assert.deepEqual(actions,['done','cancel']);
  assert.equal(dispatch('Enter','BUTTON'),false);
  assert.deepEqual(actions,['done','cancel']);
  vm.runInContext('mode="pin"; submitPin=()=>actions.push("submit");',context);
  assert.equal(dispatch('Enter','BODY'),true);
  assert.deepEqual(actions,['done','cancel','submit']);
});
