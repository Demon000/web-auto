import '@fontsource/roboto';
import 'material-symbols';

import './assets/main.css';

import {
    argbFromHex,
    themeFromSourceColor,
    applyTheme,
} from '@material/material-color-utilities';

const theme = themeFromSourceColor(argbFromHex('#60a8f0'));

applyTheme(theme, { target: document.body, dark: true });
