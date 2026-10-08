/*
 * willow.js: the only places /willow/ differs from the main site.
 * ./sync-willow.sh mirrors everything else from the main site into willow/ and
 * loads this file right after js/content.js, so it is never overwritten.
 *   - About > "Hi, I'm Dreamliner" shows gender and pronouns, and willow's own profile picture
 *     (willow/willow-avatar.png, kept outside the folders the sync replaces)
 *   - Contact > "Get in touch" uses the willow email address and adds willow's X account
 */
(function () {
  'use strict';
  var site = window.SITE;
  if (!site || !site.categories) return;

  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  var about = find(site.categories, 'about');
  var me = about && find(about.items, 'me');
  if (me) me.photo = 'willow-avatar.png';
  if (me) me.identity = { flag: 'nonbinary', label: 'Non-binary', pronouns: ['They/Them', 'She/Her'] };

  var contact = find(site.categories, 'contact');
  var touch = contact && find(contact.items, 'get-in-touch');
  if (touch) touch.summary = 'Email, Discord, GitHub and X';
  if (touch && touch.links) {
    touch.links.push({ label: 'X: @Dreamliner232', url: 'https://x.com/Dreamliner232' });
    touch.links.forEach(function (l) {
      if (/^mailto:/.test(l.url)) {
        l.label = 'Email: willow_vella@icloud.com';
        l.url = 'mailto:willow_vella@icloud.com';
      }
    });
  }
})();
