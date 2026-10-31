import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'*.spec.js',timeout:45000,use:{baseURL:'http://127.0.0.1:5177',headless:true},webServer:{command:'npm run dev -- --port 5177',url:'http://127.0.0.1:5177',reuseExistingServer:true}});
