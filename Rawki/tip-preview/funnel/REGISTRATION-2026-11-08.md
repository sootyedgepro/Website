# Registration update — November 8, 2026

The registration area now uses React Bits TearTicket, the current library name for the requested ticket with a tear-off stub and image parallax. The journey lanyard remains a separate component. The registration Stepper, Bell Toggle, calendar, timezone selector and classroom links remain functional.

## Source and dependencies

- Actual library source: D:/Programs/Web Development/ReactBits/src/components/react-bits/TearTicket.jsx and TearTicket.css.
- Registry reference: D:/Programs/Web Development/ReactBits/registry/TearTicket-JS-CSS.json. The local source matched both registry files before copying.
- Motion ^12.23.12 was already installed. No dependency was added.
- Vendor source lives in shared/vendor/react-bits. Existing project React Bits license/notice applies.

The source is retained with three narrow adaptations: the status announcement says “Preview stub detached” instead of “Used”; resizing a controlled torn ticket does not reattach its stub; disabling tilt resets the Motion springs, so the page motion toggle also settles the ticket.

## Presentation

- The ticket uses the existing Flow Tracker chart as its parallax artwork, a dark navy face and a cyan perforated stub.
- Event date/time follows the existing event model and the original timezone selector. The original DOM controls are moved intact, preserving the review code’s listeners.
- The stub can be dragged away or torn with Enter/Space. Reset restores it. Tearing is an interaction preview, not a registration submission.
- The native registration card and actual Stepper have a coordinated dark surface, cyan controls, dark inputs and visible keyboard focus. Bell Toggle, validation errors and confirmation use the same palette.
- The ticket and form timezone selections stay synchronized. Changing the timezone clears the form’s time confirmation.
- Ticket sizing follows its container; its typography stays readable at narrow widths. Tilt stops when offscreen, when the document is hidden, and when page motion is paused. The component also honors reduced motion.

## Functional behavior retained

The form checks first name, email and event consent before advancing. The time step requires confirmation and retains optional reminder selection. Existing success, duplicate, failure and ended scenarios remain available. Completion opens the classroom or downloads the calendar invitation. Details stay in the preview session; no seat, email or reminder is sent.

## Validation

All changed JSX and CSS files passed esbuild syntax transforms. Parent integration owns the combined build and browser QA. Browser checks should include desktop and narrow layouts; pointer and keyboard tear/reset; resizing a torn ticket; motion pause/reduced motion; timezone changes in both controls; required-field validation; confirmation, error, duplicate and ended scenarios; calendar download; and the classroom link.
