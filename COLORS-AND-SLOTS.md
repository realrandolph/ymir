# Named Colors, surfaces and model slots

## The contract

- **Model**: independent mesh, named parts, and baked surface slots grouping part IDs.
- **Material**: surface response, microgeometry, roughness, metalness, sheen and
  lighting behavior, including grain/weave/fibre shading detail. Each Material
  has a `defaultColorId` referencing a named Color, never an inline color value.
- **Color**: a named reusable albedo resource. Solid Colors form the palette;
  procedural Colors generate repeating patterns or pigment variations, using
  named palette Colors as their primary/secondary inputs. Pattern repeat/offset
  belong to the Color resource, not the Material.
- **Prop**: references its Model, provides placement/behavior and default slot
  assignments: `{slotId, material:{id, parameters?}, color?:{id}}`. Omitting the
  Color override uses the selected Material's default Color.
- **Variant**: inherits prop defaults and overrides selected slot assignments.
  No mesh duplication. Assigning a new Color does not change the Material's
  explicit roughness/metalness overrides.

Current inventory: **50 models, 58 props, 71 initial variants, 26 materials,
48 Colors**. Of these Colors, 38 are shared solid palette entries and 10 are
genuine pigment patterns. Existing
custom surfaces are retained; Cotton, Hemp and Plaster are additional designed
surface shaders. Pigment generators do not depend on the chosen material profile.
Grain, weave, fibres, surface occlusion, relief and sheen belong to Materials,
not Colors. Colored marbling, speckles and wood pigment bands remain reusable
Colors because they are paint/pigment variation, not surface geometry.

The old procedural-texture browser category is replaced by **Colors**, containing
both solid colors and pigment patterns.
Old descriptors/shader suites remain as source/pinned-project compatibility
resources on disk, but are not duplicated in the active catalog.

## Browser workflow

1. Choose a model family, prop and variant.
2. Click a rendered part to select/highlight it, or use the named part/slot lists.
3. Choose **Material** and **Color** resources for its surface slot. The preview
   updates all parts assigned to that slot; this is unsaved until explicitly saved.
4. Save to a **new variant** (default), the current variant, or prop defaults.
   Variants without an override inherit changed prop defaults; explicit overrides
   stay intact. Rotation and zoom are retained.

### Matching Material + Color groups

Resource naming is descriptive and color-independent: **Brushed Metal**,
**Engine-Turned Metal** (decorative machined grooves), **Mirror Glass**,
**Fine Pressed Powder**, and axis/UV-mapped **Bristle Fibres**. Legacy resource
IDs remain stable for compatibility; old names in those IDs are not display names.
`tools/rename-surface-resources.py` changes names/descriptions only and asserts
that every other field stays identical. The vanity mirror's previous **Orange 1**
is now **Bright Gold**, with exactly the same pigment values.

The former Studio Surface is **Smooth Surface**, a shared adjustable micrograin
finish used for both metallic and nonmetallic bindings. The editor labels its
existing effective slot settings as **Polished Metal**, **Satin-Finish Metal**,
**Smooth Nonmetallic Surface**, or **Matte Nonmetallic Surface**. These are display
labels, not new Materials or reassigned slots. Pair groups still use the original
Material and Color IDs; shader settings, defaults and assignments are unchanged.

The browser shell stays inside the viewport. The title/delete row sits immediately
above the preview, with no intervening controls. All remaining controls live below
the preview in a compact inspector; only that inspector and the asset list can
scroll. Raw metadata is collapsed by default. `tools/check-layout.mjs` checks five
viewport sizes and the mirror's unchanged polished-metal binding; its report and
desktop screenshot are in `reports/layout.json` and `reports/layout-1280.png`.

The surface editor defaults to **Matching Material + Color**. It groups the
model's existing slots using the selected prop/variant's effective Material ID
and resolved Color ID. Explicit Color overrides and inherited Material defaults
join the same group when they resolve to the same named Color. The dropdown shows
Material/Color names plus slot and part counts. Clicking a part selects its matching
group; highlighting, previewing and saving apply to every slot in that group.

Per-slot roughness/metalness overrides do not split a pair group. They remain
individually preserved when keeping the same Material; replacing the Material
uses the new Material's parameters. Group membership is held steady during an
unsaved preview and recalculated after saving or switching variants. Groups with
mixed explicit/inherited Colors explain that saving applies the chosen Color mode
to all their members.

Choose **Individual model slot** for finer edits. Models and baked slot definitions
are not rewritten: grouping is a non-destructive view of their current assignments.
Saving multiple slots is one revision-checked operation and validates all target
slots before writing; creating a variant creates one variant for the whole group.

The model view shows neutral geometry and slot groups; it has no appearance
assignments to edit. A prop is required to assign Material/Color resources.
Material/Color views offer pairing previews, so a pattern can be inspected on
Silk, Cotton, Hemp, metal, wax, or any other current surface.
Material previews initially use their own named default Color. Selecting another
Color previews an override; **Set as Material default Color** persists that named
reference. Slot Color dropdowns also offer **Material default**. Original prop
Color overrides remain explicit, so changing a Material default does not silently
recolor previously authored props/variants.

**New Color** authors a reusable resource. A solid palette Color gets a
name and value at definition time. Repeating patterns choose two existing solid
palette Colors and a repeat scale—there is no raw hex field on a Material or prop
assignment. The authoring dialog provides solid, checkerboard, houndstooth,
stripes and marbling generators; extracted pigment generators are also cataloged.

The pen still edits metadata only. Appearance changes use the surface panel.
Deletion remains explicit and non-cascading. In-use Materials and Colors cannot
be deleted; palette Colors used by a pattern are also protected.

## Rendering and compatibility

Current props use schema 3. Models remain schema 2; materials, Colors and the
catalog remain schema 1. `trinity/src/assets.js` resolves named resources into
renderer data. `colors/generators.glsl` is loaded separately by the new surface
suite and composed into its shader. Solid/pattern selection and palette data are
independent uniforms, not a reinterpretation of material profiles.

Mapping is explicitly UV-based for repeating patterns, or model-space XYZ for
the corresponding extracted organic patterns. Different models have different UV
layouts, so equal repeat settings do not guarantee equal physical pattern size.
This release does not add image maps, texture painting or triplanar mapping.

Initial slots are inferred from original per-part appearance equivalence across
all props/variants sharing a model. The part lists remain independent of that
grouping. Assignment changes affect the whole baked slot; creating new slots or
arbitrary per-part exceptions is not currently exposed in the browser.

`surface-color-correction.json` records the 121 removed imported Color entries and
their replacements. Most were physical surface detail, not pigment patterns;
different imported metalness values also created identical-looking duplicate
names. Remaining genuine pigment patterns are deduplicated without that irrelevant
parameter. User-authored resources are not removed by this migration.

Earlier migration records: `color-migration.json`, `color-palette-migration.json` and
`slot-inheritance.json`. `matte-migration.json` moves the original matte tabletop
response into explicit surface parameters rather than forcing it on every future
material via a mesh label. Original geometry, assignment values and legacy shaders
are regression-checked. Previously staged videos remain unchanged; future staging
includes models, Colors and the new surface suite.

Validation: `npm test` in Ymir and Trinity;
`PLAYWRIGHT_BROWSERS_PATH="$PWD/synesthesia/.cache/ms-playwright" node ymir/tools/check-surfaces.mjs`
from the workspace. Browser tests use disposable libraries, never mutate the live one.

`tools/check-color-parity.mjs` compared all 71 original appearances against the
pinned pre-extraction library at 256×256: **0/255 maximum pixel-channel difference**.
The result is recorded in `reports/color-parity.json`. This is a fixed studio
preview check, not a guarantee that future palette edits or different UV mappings
will reproduce old looks.
