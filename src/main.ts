import {GameApp} from "./app/app";
import dialogPolyfill from 'dialog-polyfill/dist/dialog-polyfill.esm.js';

const myGame = new GameApp(document.getElementById('gameApp'),  window.innerWidth/3, window.innerHeight/3);

document.getElementById('learnMore').addEventListener('click', () => {
  let dialog = document.getElementById('learnMoreDialog');
  dialogPolyfill.registerDialog(dialog);
  dialog.showModal();
});
