"""Gurú Soluciones owl mascot — procedural Blender build (headless).

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python build_owl.py -- \
      --out /path/owl_raw.glb [--preview /path/preview.png]

Blender is Z-up and the owl faces -Y; the glTF exporter converts to Y-up so in
three.js the owl faces +Z (towards the default camera).

Node hierarchy (all names are stable and used by src/three/owl/OwlRig.tsx):
  Owl
   ├ Body           (jacket, pants, shirt, lapels, tie, buttons)
   ├ Head           pivot at the neck
   │   ├ HeadMesh, Cheeks, Brows, ChinFluff
   │   ├ TuftL / TuftR       pivot at the base of each ear tuft
   │   ├ EyeL / EyeR         pivot at the eye centre (sclera + iris + pupil + highlight)
   │   ├ LidL / LidR         spherical cap, pivot at the eye centre; rotation.x 0 = closed
   │   ├ Beak
   │   └ Glasses             (rings, bridge, arms, LensL / LensR)
   ├ WingL / WingR   pivot at the shoulder, rest pose holds the document; FeathersL/R fan inside (scale 0.001)
   ├ TalonL / TalonR pivot at the ankle
   └ Document        pivot at the sheet centre (parchment + text lines + seal)
"""
import sys, math
import bpy, bmesh
from mathutils import Vector, Euler, Quaternion

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = arg("--out", "/tmp/owl_raw.glb")
PREVIEW = arg("--preview")

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- palette
COL = {
    "feather": (0.62, 0.36, 0.16),   # warm brown-tan
    "featherDark": (0.36, 0.20, 0.09),
    "cream": (0.96, 0.88, 0.72),
    "creamDark": (0.86, 0.74, 0.55),
    "navy": (0.075, 0.11, 0.30),
    "navyDark": (0.045, 0.07, 0.20),
    "pants": (0.05, 0.06, 0.12),
    "white": (0.95, 0.95, 0.93),
    "tie": (0.42, 0.08, 0.14),
    "hand": (0.55, 0.32, 0.14),
    "orange": (0.95, 0.60, 0.10),
    "black": (0.02, 0.02, 0.025),
    "sclera": (0.98, 0.98, 0.97),
    "amber": (0.85, 0.55, 0.12),
    "pupil": (0.01, 0.01, 0.012),
    "paper": (0.91, 0.82, 0.62),
    "inkLine": (0.22, 0.20, 0.20),
    "seal": (0.72, 0.10, 0.12),
    "lens": (0.55, 0.70, 1.0),
    "gold": (0.95, 0.78, 0.25),
}
MATS = {}

def mat(name, rough=0.55, alpha=None, metal=0.0, emit=None):
    key = (name, rough, alpha, metal, emit)
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(name if alpha is None else name + "Glass")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    r, g, b = COL[name]
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*COL[emit], 1.0)
        bsdf.inputs["Emission Strength"].default_value = 0.6
    if alpha is not None:
        bsdf.inputs["Alpha"].default_value = alpha
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = "BLENDED"
        if hasattr(m, "blend_method"):
            m.blend_method = "BLEND"
    m.use_backface_culling = False
    MATS[key] = m
    return m

# ---------------------------------------------------------------- helpers
def empty(name, loc, parent=None, rot=None):
    o = bpy.data.objects.new(name, None)
    o.location = loc
    if rot is not None:
        o.rotation_euler = rot
    scene.collection.objects.link(o)
    if parent:
        o.parent = parent
    return o

def link(obj, parent, name):
    obj.name = name
    obj.data.name = name
    if parent:
        obj.parent = parent
    return obj

def sphere(name, loc, scale, m, parent=None, seg=32, rings=16, rot=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1.0, location=loc)
    o = bpy.context.active_object
    o.scale = scale
    if rot is not None:
        o.rotation_euler = rot
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return link(o, parent, name)

def cone(name, loc, r1, r2, depth, m, parent=None, rot=None, verts=24, scale=None):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc)
    o = bpy.context.active_object
    if rot is not None:
        o.rotation_euler = rot
    if scale is not None:
        o.scale = scale
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return link(o, parent, name)

def cylinder(name, loc, r, depth, m, parent=None, rot=None, verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc)
    o = bpy.context.active_object
    if rot is not None:
        o.rotation_euler = rot
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return link(o, parent, name)

def torus(name, loc, major, minor, m, parent=None, rot=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=40, minor_segments=12, major_radius=major, minor_radius=minor, location=loc)
    o = bpy.context.active_object
    if rot is not None:
        o.rotation_euler = rot
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return link(o, parent, name)

def box(name, loc, size, m, parent=None, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object
    o.scale = size
    if rot is not None:
        o.rotation_euler = rot
    o.data.materials.append(m)
    return link(o, parent, name)

def cylinder_between(name, a, b, r, m, parent=None, verts=12):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return link(o, parent, name)

def flat_shape(name, pts, m, parent=None, y=-1.0, thickness=0.02, target=None, offset=0.012):
    """A flat polygon in the XZ plane, projected (shrinkwrapped) onto `target` along +Y and solidified."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z)) for x, z in pts]
    bm.faces.new(vs)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    me.materials.append(m)
    if target is not None:
        sw = o.modifiers.new("wrap", "SHRINKWRAP")
        sw.target = target
        sw.wrap_method = "PROJECT"
        sw.use_project_y = True
        sw.use_positive_direction = True
        sw.use_negative_direction = True
        sw.offset = offset
        sub = o.modifiers.new("sub", "SUBSURF")
        sub.subdivision_type = "SIMPLE"
        sub.levels = 3
        sub.render_levels = 3
        # order: subdivide first so the projection follows the curvature
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_move_to_index(modifier="sub", index=0)
        so = o.modifiers.new("solid", "SOLIDIFY")
        so.thickness = thickness
        so.offset = -1
    if parent:
        o.parent = parent
    return o

def rel(loc, parent):
    """World location → local location under an (unrotated) parent empty."""
    return tuple(Vector(loc) - Vector(parent.location))

def set_origin(o, loc):
    """Move an object's origin (pivot) to `loc` (world), keeping the geometry in place."""
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    scene.cursor.location = loc
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

# ---------------------------------------------------------------- root
root = empty("Owl", (0, 0, 0))

# ---------------------------------------------------------------- body
BODY_P = Vector((0, 0, 0.78))
body = empty("Body", BODY_P, root)
jacket = sphere("Jacket", (0, 0, 0), (0.58, 0.50, 0.52), mat("navy", 0.7), body, seg=48, rings=24)
# egg shape: widen the lower half
bpy.context.view_layer.objects.active = jacket
bpy.ops.object.mode_set(mode="EDIT")
bm = bmesh.from_edit_mesh(jacket.data)
for v in bm.verts:
    if v.co.z < 0:
        f = 1.0 + 0.22 * (-v.co.z)
        v.co.x *= f
        v.co.y *= f
bmesh.update_edit_mesh(jacket.data)
bpy.ops.object.mode_set(mode="OBJECT")

sphere("Pants", rel((0, 0, 0.34), body), (0.50, 0.42, 0.30), mat("pants", 0.8), body)
# shirt V, lapels and tie hug the jacket (coordinates are body-local; jacket top is z≈+0.52)
flat_shape("Shirt", [(-0.24, 0.50), (0.24, 0.50), (0.0, -0.14)], mat("white", 0.6), body, target=jacket, offset=0.008)
flat_shape("LapelL", [(0.05, 0.50), (0.30, 0.44), (0.34, 0.30), (0.10, -0.24)], mat("navyDark", 0.7), body, target=jacket, offset=0.014)
flat_shape("LapelR", [(-0.05, 0.50), (-0.30, 0.44), (-0.34, 0.30), (-0.10, -0.24)], mat("navyDark", 0.7), body, target=jacket, offset=0.014)
flat_shape("Tie", [(-0.045, 0.42), (0.045, 0.42), (0.075, 0.16), (0.0, -0.16), (-0.075, 0.16)], mat("tie", 0.5), body, target=jacket, offset=0.026)
sphere("TieKnot", rel((0, -0.46, 1.24), body), (0.065, 0.045, 0.055), mat("tie", 0.5), body, seg=16, rings=8)
for i, z in enumerate((0.60, 0.46)):
    sphere(f"Button{i}", rel((0.0, -0.54, z), body), (0.028, 0.02, 0.028), mat("black", 0.4), body, seg=12, rings=6)
# pocket square, character's right chest (viewer's left)
flat_shape("Pocket", [(-0.33, 0.26), (-0.21, 0.26), (-0.27, 0.36)], mat("white", 0.6), body, target=jacket, offset=0.03)
# gold pin
sphere("Pin", rel((0.26, -0.45, 1.06), body), (0.03, 0.02, 0.03), mat("gold", 0.3, metal=0.8), body, seg=12, rings=6)

# ---------------------------------------------------------------- head
HEAD_C = Vector((0, 0, 1.68))
head = empty("Head", (0, 0, 1.22), root)
sphere("HeadMesh", rel(HEAD_C, head), (0.64, 0.58, 0.56), mat("feather", 0.75), head, seg=48, rings=24)
# facial disc: two cream cheeks
for s, nm in ((1, "CheekL"), (-1, "CheekR")):
    sphere(nm, rel((s * 0.21, -0.40, 1.60), head), (0.40, 0.26, 0.42), mat("cream", 0.8), head)
# chin fluff
sphere("ChinFluff", rel((0, -0.36, 1.26), head), (0.44, 0.24, 0.17), mat("cream", 0.8), head)
# dark V brows meeting above the beak
for s, nm in ((1, "BrowL"), (-1, "BrowR")):
    sphere(nm, rel((s * 0.25, -0.54, 1.90), head), (0.33, 0.09, 0.085), mat("featherDark", 0.8), head,
           rot=Euler((math.radians(-10), s * math.radians(-30), 0)))

# ear tufts
for s, nm in ((1, "TuftL"), (-1, "TuftR")):
    base = rel((s * 0.46, -0.04, 2.08), head)
    t = empty(nm, base, head)
    t.rotation_euler = Euler((math.radians(10), s * math.radians(52), 0))
    cone("TuftMesh" + nm[-1], (0, 0, 0.24), 0.17, 0.0, 0.56, mat("feather", 0.75), t, verts=20, scale=(1.0, 0.5, 1.0))
    # small darker inner feather
    cone("TuftInner" + nm[-1], (s * 0.04, -0.05, 0.20), 0.10, 0.0, 0.40, mat("featherDark", 0.8), t,
         rot=Euler((math.radians(6), s * math.radians(8), 0)), verts=12, scale=(1.0, 0.5, 1.0))

# eyes
EYE_R = 0.175
for s, nm in ((1, "L"), (-1, "R")):
    ec = Vector((s * 0.235, -0.56, 1.66))
    e = empty("Eye" + nm, rel(ec, head), head)
    sphere("Sclera" + nm, (0, 0, 0), (EYE_R, EYE_R, EYE_R), mat("sclera", 0.25), e)
    sphere("Iris" + nm, (0, -EYE_R * 0.88, 0), (0.125, 0.04, 0.125), mat("amber", 0.35), e)
    sphere("Pupil" + nm, (0, -EYE_R * 1.01, 0), (0.07, 0.022, 0.07), mat("pupil", 0.2), e, seg=20, rings=10)
    sphere("Shine" + nm, (s * -0.035, -EYE_R * 1.08, 0.045), (0.028, 0.012, 0.028), mat("sclera", 0.1, emit="sclera"), e, seg=12, rings=6)
    # eyelid: front cap of a slightly bigger sphere; rotation.x = 0 closed, ~-100° open
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=EYE_R * 1.07, location=rel(ec, head))
    lid = bpy.context.active_object
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(lid.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > -0.02], context="VERTS")
    bmesh.update_edit_mesh(lid.data)
    bpy.ops.object.mode_set(mode="OBJECT")
    lid.data.materials.append(mat("creamDark", 0.8))
    bpy.ops.object.shade_smooth()
    link(lid, head, "Lid" + nm)
    lid.rotation_euler = Euler((math.radians(-105), 0, 0))
    # a lash line at the lid edge
    # (kept simple: the cap edge reads as the lid)

# beak: cone pointing down and a little forward, with a hook
beak = empty("Beak", rel((0, -0.64, 1.56), head), head)
cone("BeakMesh", (0, -0.03, -0.12), 0.10, 0.012, 0.30, mat("orange", 0.35), beak,
     rot=Euler((math.radians(162), 0, 0)), verts=16, scale=(1.0, 0.85, 1.0))
sphere("BeakBase", (0, 0.0, 0.0), (0.10, 0.08, 0.07), mat("orange", 0.35), beak, seg=16, rings=8)

# glasses
GL_Y = -0.75
glasses = empty("Glasses", rel((0, GL_Y, 1.66), head), head)
for s, nm in ((1, "L"), (-1, "R")):
    torus("Rim" + nm, (s * 0.235, 0, 0), 0.205, 0.022, mat("black", 0.3), glasses, rot=Euler((math.radians(90), 0, 0)))
    bpy.ops.mesh.primitive_circle_add(vertices=40, radius=0.20, fill_type="NGON", location=(s * 0.235, 0.005, 0))
    lens = bpy.context.active_object
    lens.rotation_euler = Euler((math.radians(90), 0, 0))
    lens.data.materials.append(mat("lens", 0.05, alpha=0.14))
    link(lens, glasses, "Lens" + nm)
    # arm: from the outer rim back along the head to behind the tuft
    cylinder_between("Arm" + nm, (s * 0.44, 0.0, 0.02), (s * 0.60, 0.62, 0.10), 0.016, mat("black", 0.3), glasses)
    cylinder_between("ArmTip" + nm, (s * 0.60, 0.62, 0.10), (s * 0.56, 0.72, -0.02), 0.016, mat("black", 0.3), glasses)
cylinder_between("Bridge", (-0.04, 0.0, 0.03), (0.04, 0.0, 0.03), 0.018, mat("black", 0.3), glasses)

# ---------------------------------------------------------------- wings (arms)
WING_LEN = 0.86
for s, nm in ((1, "L"), (-1, "R")):
    shoulder = Vector((s * 0.52, -0.02, 1.16))
    hand_target = Vector((s * 0.25, -0.64, 0.40))
    d = hand_target - shoulder
    w = empty("Wing" + nm, shoulder, root)
    w.rotation_mode = "QUATERNION"
    w.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(d.normalized())
    L = d.length
    # sleeve: tapered capsule along -Z
    sleeve = sphere("Sleeve" + nm, (0, 0, -L * 0.48), (0.19, 0.17, L * 0.55), mat("navy", 0.7), w, seg=24, rings=16)
    # shoulder pad
    sphere("Shoulder" + nm, (0, 0, -0.06), (0.22, 0.20, 0.18), mat("navy", 0.7), w, seg=24, rings=12)
    # white cuff
    cylinder("Cuff" + nm, (0, 0, -L * 0.94), 0.135, 0.06, mat("white", 0.6), w, verts=20)
    # hand: brown palm + three feathered fingers wrapping forward
    hand = empty("Hand" + nm, (0, 0, -L - 0.02), w)
    sphere("Palm" + nm, (0, 0, 0), (0.13, 0.11, 0.10), mat("hand", 0.85), hand, seg=20, rings=10)
    for i, (fx, fz) in enumerate(((-0.07, 0.04), (0.0, 0.05), (0.07, 0.03))):
        sphere(f"Finger{nm}{i}", (fx, -0.10, fz - 0.02), (0.035, 0.09, 0.035), mat("hand", 0.85), hand, seg=12, rings=8,
               rot=Euler((math.radians(-25), 0, 0)))
    # flight feathers fan (scaled to ~0 in the file; the rig scales it up in flight)
    feathers = empty("Feathers" + nm, (0, 0, -L * 0.82), w)
    for i in range(6):
        a = math.radians(-40 + i * 16)
        fl = 0.55 + 0.12 * (1 - abs(i - 2.5) / 2.5)
        f = sphere(f"Feather{nm}{i}", (0, 0, 0), (0.055, 0.02, fl / 2), mat("feather" if i % 2 else "featherDark", 0.8), feathers, seg=12, rings=8)
        f.rotation_euler = Euler((0, s * a, 0))
        # shift so the feather starts at the fan pivot
        f.location = Vector((s * math.sin(a) * -fl / 2, 0, -math.cos(a) * fl / 2))
    feathers.scale = (0.001, 0.001, 0.001)

# ---------------------------------------------------------------- talons
for s, nm in ((1, "L"), (-1, "R")):
    ankle = Vector((s * 0.20, -0.05, 0.16))
    t = empty("Talon" + nm, ankle, root)
    sphere("Foot" + nm, (0, -0.06, -0.10), (0.13, 0.17, 0.07), mat("orange", 0.5), t, seg=16, rings=8)
    for i, (tx, ty) in enumerate(((-0.09, -0.24), (0.0, -0.28), (0.09, -0.24))):
        sphere(f"Toe{nm}{i}", (tx, ty, -0.12), (0.04, 0.10, 0.035), mat("orange", 0.5), t, seg=12, rings=6)
        sphere(f"Claw{nm}{i}", (tx, ty - 0.10, -0.135), (0.02, 0.04, 0.018), mat("black", 0.4), t, seg=8, rings=4)
    sphere(f"ToeBack{nm}", (0, 0.10, -0.12), (0.04, 0.07, 0.03), mat("orange", 0.5), t, seg=12, rings=6)

# ---------------------------------------------------------------- document
DOC_C = Vector((0, -0.68, 0.54))
DOC_W, DOC_H = 0.54, 0.66
doc = empty("Document", DOC_C, root)
doc.rotation_euler = Euler((math.radians(-18), 0, 0))
me = bpy.data.meshes.new("Paper")
bm = bmesh.new()
NX, NZ = 12, 14
grid = []
for iz in range(NZ + 1):
    row = []
    for ix in range(NX + 1):
        x = -DOC_W / 2 + DOC_W * ix / NX
        z = -DOC_H / 2 + DOC_H * iz / NZ
        # gentle curl: the sheet bows towards the reader with lifted corners
        y = -0.03 * math.cos(x / DOC_W * math.pi) * (0.5 + 0.5 * math.cos(z / DOC_H * math.pi))
        y += 0.02 * math.sin(x / DOC_W * math.pi * 2) * (z / DOC_H)
        row.append(bm.verts.new((x, y, z)))
    grid.append(row)
for iz in range(NZ):
    for ix in range(NX):
        bm.faces.new((grid[iz][ix], grid[iz][ix + 1], grid[iz + 1][ix + 1], grid[iz + 1][ix]))
bm.to_mesh(me)
bm.free()
paper = bpy.data.objects.new("Paper", me)
scene.collection.objects.link(paper)
paper.parent = doc
me.materials.append(mat("paper", 0.9))
so = paper.modifiers.new("solid", "SOLIDIFY")
so.thickness = 0.012
so.offset = 1
bpy.context.view_layer.objects.active = paper
bpy.ops.object.select_all(action="DESELECT")
paper.select_set(True)
bpy.ops.object.shade_smooth()
# text lines on the front face
lines = [(0.34, 0.30, 0.022), (0.20, 0.22, 0.012), (0.44, 0.15, 0.012), (0.40, 0.09, 0.012), (0.44, 0.03, 0.012),
         (0.36, -0.03, 0.012), (0.44, -0.09, 0.012), (0.30, -0.15, 0.012), (0.24, -0.30, 0.012)]
for i, (w, z, h) in enumerate(lines):
    x0 = -DOC_W / 2 + 0.08 + w / 2 if i else 0.0
    box(f"Line{i}", (x0, -0.045, z), (w, 0.006, h), mat("inkLine", 0.8), doc)
# red seal bottom-right + signature stroke
cylinder("Seal", (0.17, -0.048, -0.27), 0.065, 0.006, mat("seal", 0.6), doc, rot=Euler((math.radians(90), 0, 0)), verts=24)
torus("SealRing", (0.17, -0.052, -0.27), 0.058, 0.006, mat("paper", 0.9), doc, rot=Euler((math.radians(90), 0, 0)))
box("Signature", (-0.05, -0.048, -0.31), (0.16, 0.006, 0.012), mat("inkLine", 0.8), doc, rot=Euler((0, math.radians(-8), 0)))
# stamp/seal on the document that the rig can glow: keep as is

# ---------------------------------------------------------------- finish
bpy.ops.object.select_all(action="DESELECT")
mesh_count = 0
for o in scene.objects:
    if o.type == "MESH":
        mesh_count += 1
print("meshes:", mesh_count)

def bounds():
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    dg = bpy.context.evaluated_depsgraph_get()
    for o in scene.objects:
        if o.type != "MESH" or o.name.startswith("Feather"):
            continue
        ev = o.evaluated_get(dg)
        for v in ev.data.vertices:
            p = ev.matrix_world @ v.co
            lo.x, lo.y, lo.z = min(lo.x, p.x), min(lo.y, p.y), min(lo.z, p.z)
            hi.x, hi.y, hi.z = max(hi.x, p.x), max(hi.y, p.y), max(hi.z, p.z)
    return lo, hi
lo, hi = bounds()
print("bounds min", tuple(round(v, 3) for v in lo), "max", tuple(round(v, 3) for v in hi))

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_animations=False,
    export_skins=False,
    export_morph=False,
    export_cameras=False,
    export_lights=False,
    export_extras=False,
    export_texcoords=False,
    export_normals=True,
)
print("wrote", OUT)

# ---------------------------------------------------------------- preview render
if PREVIEW:
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0.0, -6.4, 1.35)
    cam.rotation_euler = Euler((math.radians(88), 0, 0))
    cam_data.lens = 65
    scene.camera = cam
    def light(name, kind, loc, energy, color=(1, 1, 1), size=2.0):
        ld = bpy.data.lights.new(name, kind)
        ld.energy = energy
        ld.color = color
        if kind == "AREA":
            ld.size = size
        lo_ = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo_)
        lo_.location = loc
        direction = Vector((0, 0, 1.3)) - Vector(loc)
        lo_.rotation_mode = "QUATERNION"
        lo_.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(direction)
        return lo_
    light("Key", "AREA", (3.0, -4.5, 4.0), 420, (1.0, 0.95, 0.88), 3.0)
    light("Fill", "AREA", (-4.0, -3.5, 1.5), 160, (0.75, 0.82, 1.0), 4.0)
    light("Rim", "AREA", (-1.5, 3.5, 3.5), 500, (0.55, 0.65, 1.0), 2.0)
    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.03, 0.05, 0.14, 1.0)
    bg.inputs[1].default_value = 0.6
    for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scene.render.engine = eng
            break
        except TypeError:
            pass
    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1000
    scene.render.filepath = PREVIEW
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    print("preview", PREVIEW)
