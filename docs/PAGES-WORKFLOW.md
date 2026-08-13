# ملاحظة: نشر GitHub Pages من `dist/`

النشر الحالي (`.github/workflows/static.yml`) بيرفع **جذر الريبو** (`path: '.'`) وده شغّال تمام،
لأن `index.html` و`js/` و`sw.js` كلهم في الجذر.

لو حابب تنشر من `dist/` بدل الجذر (أنضف — من غير `scripts/` و`supabase/` و`docs/`)،
عدّل الملف يدوياً من واجهة GitHub — الـ Agent مش مسموح له يعدّل ملفات الـ workflows:

```yaml
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Build (dist/)
        run: node scripts/build.js
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'dist'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

الملف بيحطّ `.nojekyll` تلقائياً في `dist/`، فمفيش حاجة زيادة تتعمل.
