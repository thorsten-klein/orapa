import { test, expect, openApp } from './fixtures.js';

test('app boots and shows main menu', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#screen-main')).not.toHaveClass(/hidden/);
    await expect(page.locator('#btn-start-game')).toBeVisible();
});
