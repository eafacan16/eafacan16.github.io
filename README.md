# Şifreli CV sitesi

GitHub Pages üzerinde yayınlanan, içeriği ziyaretçinin tarayıcısında çözülen özgeçmiş sayfası.

## Nasıl çalışır

- Kişisel bilgiler (`profile.json`) ve fotoğraf yerelde 256-bit rastgele bir anahtarla şifrelenip `data.js` dosyasına yazılır. Repoda ve sitede yalnızca bu şifreli paket bulunur.
- Anahtar, paylaşım bağlantısının `#` işaretinden sonraki kısmıdır: `https://eafacan16.github.io/#ANAHTAR`. Tarayıcılar `#` sonrasını sunucuya göndermez.
- Bağlantıyı (veya CV'deki QR kodu) alan herkes CV'yi görüntüleyebilir ve iletebilir. Erişimi kesmek için anahtarı yenileyin (aşağıda).
- Sayfadaki **PDF indir** yazdırma penceresini A4 CV düzeniyle açar ("PDF olarak kaydet" seçilir). **Word indir** gerçek bir `.docx` üretir. İkisi de paylaşım bağlantısının QR kodunu içerir.

## Güncelleme

Gereken: Node.js 18+.

1. `profile.example.json` dosyasını `profile.json` olarak kopyalayın (ilk sefer) ve bilgileri düzenleyin. Boş bırakılan alanlar CV'de görünmez. `photo` alanı yerel bir .png/.jpg yoludur.
2. `node tools/build.mjs` çalıştırın. Mevcut `profile.key` korunur, böylece daha önce dağıtılan bağlantılar ve QR kodlar çalışmaya devam eder. Komut paylaşım bağlantısını yazdırır.
3. `data.js` ve `index.html` değişikliklerini commit edip `main` dalına gönderin. GitHub Actions siteyi yayınlar.

Anahtarı yenilemek (eski bağlantıları ve QR kodları geçersiz kılmak) için: `node tools/build.mjs --new-key`.

**`profile.json` ve `profile.key` dosyalarını yedekleyin.** Git'e girmezler; anahtar kaybolursa mevcut `data.js` açılamaz ve yeni anahtarla yeniden oluşturmak gerekir.

## Yayın ayarı

Repo ayarlarında **Settings → Pages → Build and deployment → Source: GitHub Actions** seçili olmalıdır. "Deploy from a branch" seçiliyse her commit iki ayrı yayın tetikler.

## Kullanılan kütüphaneler

`vendor/` altında, CDN'e bağımlı olmamak için repoyla birlikte gelir: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 (MIT), [docx](https://github.com/dolanmiu/docx) 8.5.0 (MIT).
