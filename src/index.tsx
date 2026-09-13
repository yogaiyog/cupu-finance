/* @refresh reload */
import { render } from 'solid-js/web';
import './index.css';
import { App } from './App';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error('Root element #root tidak ditemukan di index.html');
}

render(() => <App />, root!);
