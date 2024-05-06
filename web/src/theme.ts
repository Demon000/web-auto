import '@fontsource/roboto';
import 'material-symbols';

import './assets/main.css';

import {
    argbFromHex,
    themeFromSourceColor,
    applyTheme,
} from '@material/material-color-utilities';
import { WEB_CONFIG } from './config.js';

const theme = themeFromSourceColor(argbFromHex(WEB_CONFIG.themeColor));

applyTheme(theme, { target: document.body, dark: true });
