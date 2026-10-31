import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('desktop: club selection, kickoff, real flick, pause and restart',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1100});await page.goto('/');await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('#home-name')).toHaveText('Flamengo');
  expect(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
  await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
  await page.locator('#select-home').click();await expect(page.locator('.club-option')).toHaveCount(20);await page.locator('#club-search').fill('Corinthians');await page.getByRole('button',{name:'Corinthians COR'}).click();await expect(page.locator('#home-name')).toHaveText('Corinthians');
  await page.locator('#mode-local').click();await page.locator('#start').click();await expect(page.locator('#turn-title')).toHaveText('Vez de Corinthians');await expect(page.locator('#select-home')).toBeDisabled();
  const r=await page.locator('#field').boundingBox();const x=r.x+522/1200*r.width,y=r.y+390/780*r.height;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-110/1200*r.width,y-25/780*r.height,{steps:8});await expect(page.locator('#power-value')).not.toHaveText('0%');await page.screenshot({path:'artifacts/aim.png'});await page.mouse.up();
  await expect(page.locator('#turn-subtitle')).toHaveText('Bola em jogo…');
  await page.waitForTimeout(1000);await page.locator('#pause').click();const time=await page.locator('#clock').textContent();await page.waitForTimeout(1100);await expect(page.locator('#clock')).toHaveText(time);await page.locator('#overlay-action').click();await expect(page.locator('#center-overlay')).toBeHidden();
  await expect(page.locator('#turn-subtitle')).not.toHaveText('Bola em jogo…',{timeout:15000});
  await page.locator('#start').click();await expect(page.locator('#overlay-title')).toHaveText('Começar de novo?');await page.getByRole('button',{name:'Voltar à partida'}).click();await expect(page.locator('#center-overlay')).toBeHidden();
  await page.locator('#start').click();await page.locator('#overlay-action').click();await expect(page.locator('#score-home')).toHaveText('0');await expect(page.locator('#turn-title')).toHaveText('Vez de Corinthians');
  await page.locator('#help-top').click();await expect(page.locator('#help-dialog')).toBeVisible();await page.locator('#help-dialog .close-dialog').click();expect(errors).toEqual([]);
});

test('mobile: no overflow, touch flick, machine response, saved settings',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
  await page.locator('#select-away').click();await page.locator('#club-search').fill('Grêmio');await page.locator('[data-team="6273"]').click();await page.locator('#duration').selectOption('120');await page.locator('#start').click();
  await page.locator('#field').scrollIntoViewIfNeeded();const r=await page.locator('#field').boundingBox();const x=r.x+522/1200*r.width,y=r.y+390/780*r.height;
  const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+12,y:y-40}]});await expect(page.locator('#power-value')).not.toHaveText('0%');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('#turn-subtitle')).toHaveText('Bola em jogo…');await expect(page.locator('#turn-title')).toHaveText('Vez do Grêmio',{timeout:18000});await expect(page.locator('#turn-subtitle')).toHaveText('Bola em jogo…',{timeout:10000});
  await page.reload();await expect(page.locator('#away-name')).toHaveText('Grêmio');await expect(page.locator('#duration')).toHaveValue('120');expect(errors).toEqual([]);await context.close();
});

test('a real goal updates the scoreboard, gives the opponent kickoff, and the match ends',async({page})=>{
  await page.addInitScript(()=>{
    let next=[],now=0;
    window.requestAnimationFrame=cb=>{next.push(cb);return next.length};
    window.advanceGame=frames=>{for(let i=0;i<frames;i++){now+=1000/60;const list=next;next=[];list.forEach(cb=>cb(now))}};
  });
  await page.goto('/');await page.locator('#mode-local').click();await page.locator('#duration').selectOption('120');await page.locator('#start').click();
  const r=await page.locator('#field').boundingBox(),x=r.x+522/1200*r.width,y=r.y+390/780*r.height;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-110/1200*r.width,y-7/780*r.height);await page.mouse.up();
  await page.evaluate(()=>window.advanceGame(260));await expect(page.locator('#score-home')).toHaveText('1');await expect(page.locator('#turn-title')).toHaveText('Vez de Palmeiras');
  await page.evaluate(()=>window.advanceGame(7600));await expect(page.locator('#overlay-title')).toHaveText('Flamengo venceu!');await expect(page.locator('#clock')).toHaveText('00:00');await expect(page.locator('#pause')).toBeDisabled();
  await page.locator('#overlay-action').click();await expect(page.locator('#score-home')).toHaveText('0');await expect(page.locator('#clock')).toHaveText('02:00');
});

test('keyboard controls, fullscreen fallback and small landscape view',async({page})=>{
  await page.goto('/');await page.locator('#mode-local').click();await page.locator('#start').click();
  await page.locator('#field').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#power-value')).toHaveText('50%');await page.keyboard.press('Escape');await expect(page.locator('#power-value')).toHaveText('0%');await page.keyboard.press('Space');await expect(page.locator('#turn-subtitle')).toHaveText('Bola em jogo…');
  await page.evaluate(()=>Object.defineProperty(document.getElementById('arena'),'requestFullscreen',{value:undefined}));
  await page.locator('#fullscreen').click();await expect(page.locator('#arena')).toHaveClass(/immersive/);await expect(page.locator('#exit-fullscreen')).toBeVisible();await page.locator('#exit-fullscreen').click();await expect(page.locator('#arena')).not.toHaveClass(/immersive/);
  await page.setViewportSize({width:844,height:390});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
