## Summary

-

## Risk Class

Risk class: low | medium | high

Impact area:

- docs
- harness
- domain
- shell runtime
- MPRIS
- lyrics provider
- cache
- release

## Verification

Commands run:

```bash
npm run verify
```

Result:

```text
pending
```

Additional checks, if any:

```bash
# npm audit
```

## Runtime Evidence

Required for medium/high-risk changes and any change that touches GNOME Shell runtime behavior, D-Bus/MPRIS behavior, settings, packaging, or UI.

- GNOME Shell version:
- Session type:
- Player:
- Scenario(s):
- Artifact path(s):
- Notes:

## Screenshots Or Logs

Required when UI behavior, runtime behavior, or error handling changed.

- Screenshots:
- Logs:

## Checklist

- [ ] I updated docs or harness rules when behavior/policy changed.
- [ ] I added or updated tests for pure logic changes.
- [ ] I recorded runtime evidence when static checks are not enough.
- [ ] I did not install or reload the extension on a user desktop without explicit approval.
