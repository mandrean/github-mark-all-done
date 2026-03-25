# GitHub: Mark All Notifications Done

A userscript that adds a **"Mark all as done"** button to GitHub notification groups.

GitHub's notifications page only shows a limited number of notifications per repository group. This script adds a button that marks **all** notifications for a repository as done — including the hidden, paginated ones that aren't visible on the page.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/)
2. Open Teampermonkey/Greasemonkey, create a new script, and copy-paste the contents of `github-mark-all-done.user.js`.

## How it works

On the [GitHub notifications page](https://github.com/notifications) (grouped by repository), each group that has more notifications than are shown gets a **"Mark all as done"** button next to the existing "Mark as read" button.

Clicking it:
1. Fetches all pages of notifications for that repository
2. Submits the "Done" action for each notification
3. Shows a progress toast with a count
4. Removes the group from the page when complete

## License

MIT
