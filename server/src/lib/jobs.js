import { notify } from '../models/Notification.js';
import { getSettings } from '../models/Settings.js';
import { Subscription } from '../models/Subscription.js';
import { User } from '../models/User.js';
import { computeEntitlement, DAY } from './entitlement.js';
import { sendEmail } from './email.js';

const d = (date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

// Sends renewal reminders and end-of-subscription notices. Each message goes once (deduplicated by key).
// It never hides or deletes anything: listings drop out of search by date (sellerAccessUntil).
export async function runSubscriptionJobs(now = new Date()) {
  const settings = await getSettings({ fresh: true });
  const thresholds = [...settings.reminderDays].sort((a, b) => a - b);
  const subs = await Subscription.find({});
  let sent = 0;
  for (const sub of subs) {
    const e = computeEntitlement(sub, settings, 0, now);
    const day = e.endsAt.toISOString().slice(0, 10);
    let msg = null;
    if (e.state === 'trial' || e.state === 'active') {
      const t = thresholds.find((x) => e.daysLeft <= x);
      if (t !== undefined) {
        msg = {
          kind: 'renewal_reminder', key: `renew:${day}:${t}`,
          title: e.state === 'trial' ? `Your free trial ends in ${e.daysLeft} day${e.daysLeft === 1 ? '' : 's'}` : `Your plan ends in ${e.daysLeft} day${e.daysLeft === 1 ? '' : 's'}`,
          body: `It ends on ${d(e.endsAt)}. ${e.state === 'trial' ? 'Choose a plan' : 'Renew'} to keep your listings visible. If it lapses, listings stay visible for ${settings.graceDays} more days and are then hidden (not deleted).`,
        };
      }
    } else if (e.state === 'grace') {
      msg = { kind: 'subscription_ended', key: `ended:${day}`, title: 'Your subscription has ended',
        body: `Your listings stay visible until ${d(e.graceEndsAt)}. After that they are hidden from buyers until you renew. You can't add photos or publish new listings meanwhile.` };
    } else if (e.state === 'expired' && now - e.graceEndsAt < 30 * DAY) {
      msg = { kind: 'listings_hidden', key: `hidden:${day}`, title: 'Your listings are now hidden',
        body: `Your listings and photos are kept until ${d(e.retentionUntil)}. Renew any time to show them again.` };
    }
    if (msg && (await notify(sub.seller, msg.kind, msg.key, msg.title, msg.body))) {
      const user = await User.findById(sub.seller, { email: 1 });
      if (user?.email) await sendEmail(user.email, msg.title, msg.body);
      sent += 1;
    }
  }
  return { checked: subs.length, sent };
}
