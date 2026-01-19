import ReactDOM from 'react-dom/client';

import './i18n';
import './styles/variables.css';
import 'katex/dist/katex.min.css';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
