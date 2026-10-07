import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {FormKeyboard, keyboardHook, keyboardVisibilityHook} from '../src/keyboard.ts';

test('touch opens keyboard on amount; typing edits original input without an Apply step',async()=>{
 const w=new Window();w.document.body.innerHTML='<input class="amount-input" value="1000"><input type="checkbox"><button>Pay</button>';
 let shown=0,hidden=0,inputs=0;
 const states:boolean[]=[];const keyboard=new FormKeyboard(open=>states.push(open));
 const input=w.document.querySelector('input')!;
 input.addEventListener('input',()=>inputs++);
 const detach=keyboard.attach(w.document as any,{ShowVirtualKeyboard:()=>shown++,HideVirtualKeyboard:()=>hidden++,BIsActive:()=>true});
 input.click();assert.equal(shown,1);assert.equal(input.selectionStart,0);assert.equal(input.selectionEnd,4);
 keyboard.options.onTextEntered('2');keyboard.options.onTextEntered('5');keyboard.options.onTextEntered('0');
 assert.equal(input.value,'250');assert.equal(inputs,3);
 keyboard.options.onTextEntered('Backspace');assert.equal(input.value,'25');
 keyboard.options.onTextEntered('Enter');assert.equal(hidden,1);assert.equal(states.at(-1),false);
 w.document.querySelectorAll('input')[1].click();assert.equal(shown,1,'checkbox must not open text entry');
 detach();input.click();assert.equal(shown,1,'cleanup removes click listener');await w.happyDOM.close();
});
test('only the connected editable field receives keyboard text',async()=>{
 const w=new Window();w.document.body.innerHTML='<input value="1000">';
 const keyboard=new FormKeyboard(()=>{});const detach=keyboard.attach(w.document as any,{ShowVirtualKeyboard:()=>{},HideVirtualKeyboard:()=>{},BIsActive:()=>true});
 w.document.querySelector('input')!.click();w.document.body.replaceChildren();keyboard.options.onTextEntered('4');
 assert.equal(keyboard.open,false);detach();await w.happyDOM.close();
});
test('Steam keyboard discovery uses method signatures, not build-specific export names',()=>{
 const provider=Function('return factory.CreateVirtualKeyboardRef.bind(factory)');
 const hook=Function('return react.useContext(context).current');
 assert.equal(keyboardHook({random:provider,another:hook}),hook);
 assert.equal(keyboardHook({other:()=>{}}),undefined);
 const visible=Function('return store.IsShowingVirtualKeyboard');
 assert.equal(keyboardVisibilityHook({renamed:visible}),visible);
});
test('missing Steam keyboard context reports a fallback instead of leaving the form collapsed',async()=>{
 const w=new Window();w.document.body.innerHTML='<input value="1000">';let failures=0;
 const keyboard=new FormKeyboard(()=>{},()=>failures++);
 const detach=keyboard.attach(w.document as any,{ShowVirtualKeyboard:()=>{},HideVirtualKeyboard:()=>{},BIsActive:()=>false});
 w.document.querySelector('input')!.click();assert.equal(failures,1);assert.equal(keyboard.open,false);
 detach();await w.happyDOM.close();
});

test('touch transfers controller selection and every keyboard dismissal restores host focus',async()=>{
 const w=new Window();w.document.body.innerHTML='<button style="outline:1px solid red">Menu</button><input value="1000">';
 const old=w.document.querySelector('button')!,input=w.document.querySelector('input')!;
 (w as any).__sb_decky_focus=old;(w as any).__sb_decky_focusStyle={element:old,outline:'1px solid red'};old.style.outline='3px solid blue';
 let restored=0;const keyboard=new FormKeyboard(()=>{},()=>{},()=>restored++);
 const detach=keyboard.attach(w.document as any,{ShowVirtualKeyboard:()=>{},HideVirtualKeyboard:()=>{},BIsActive:()=>true});
 input.click();assert.equal((w as any).__sb_decky_focus,input);assert.equal(old.style.outlineWidth,'1px');assert.equal(old.style.outlineColor,'red');
 keyboard.options.onTextEntered('Enter');assert.equal(restored,1);assert.equal((w as any).__sb_decky_focus,input);
 input.click();keyboard.options.onKeyboardNavOut();assert.equal(restored,2);
 detach();await w.happyDOM.close();
});
