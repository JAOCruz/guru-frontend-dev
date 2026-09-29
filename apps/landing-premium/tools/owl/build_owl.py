"""Gurú Soluciones owl mascot — procedural Blender build (headless), v3 "PS2 low-poly".

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python build_owl.py -- \
      --out /path/owl_raw.glb [--preview /path/preview.png] [--views]

Stylized low-poly (≈5–7k triangles), flat vertex-colour painting in the mascot palette, clean silhouette
that reads at small sizes. Blender is Z-up and the owl faces -Y; the glTF exporter converts to Y-up so in
three.js the owl faces +Z.

Node hierarchy (names/pivots are used by src/three/owl/OwlRig.tsx — keep them):
  Owl
   ├ Body           jacket (squared shoulders), pants, shirt, collar, lapels, tie + knot, pocket square, buttons, pin
   ├ Head           pivot at the neck
   │   ├ HeadMesh   sculpted low-poly sphere: facial-disc bulge + vertex colours (cream disc, rusty rim, dark V brow)
   │   ├ BrowL/R    one dark flat blade per side
   │   ├ TuftL/R    pivot at the base; 4 flat blades per side
   │   ├ EyeL/R     pivot at the eye centre (sclera + iris + pupil + highlight)
   │   ├ LidL/R     cap, pivot at the eye centre; rotation.x 0 = closed, rest = half-open (sleepy wise)
   │   ├ Beak, Glasses (RimL/R, LensL/R, arms, bridge)
   ├ WingL/R        pivot at the shoulder; sleeve + cuff + mitt; FeathersL/R fan inside (scale 0.001)
   ├ TalonL/R       pivot at the ankle
   └ Document       pivot at the sheet centre
"""
import sys, math
import bpy, bmesh
from mathutils import Vector, Euler, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = arg("--out", "/tmp/owl_raw.glb")
PREVIEW = arg("--preview")
VIEWS = "--views" in argv

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- palette (linear RGB)
COL = {
    "feather": (0.30, 0.15, 0.055),
    "featherLight": (0.50, 0.29, 0.13),
    "featherDark": (0.15, 0.07, 0.03),
    "cream": (0.80, 0.62, 0.38),
    "creamLight": (0.90, 0.75, 0.50),
    "rust": (0.62, 0.25, 0.06),
    "navy": (0.035, 0.055, 0.21),
    "navyDark": (0.02, 0.03, 0.13),
    "pants": (0.045, 0.05, 0.10),
    "white": (0.95, 0.95, 0.93),
    "tie": (0.42, 0.07, 0.13),
    "tieDark": (0.25, 0.04, 0.08),
    "hand": (0.36, 0.19, 0.07),
    "orange": (0.88, 0.46, 0.05),
    "orangeDeep": (0.80, 0.40, 0.05),
    "black": (0.02, 0.02, 0.025),
    "sclera": (0.98, 0.98, 0.97),
    "amber": (0.82, 0.50, 0.08),
    "pupil": (0.01, 0.01, 0.012),
    "paper": (0.88, 0.76, 0.52),
    "inkLine": (0.22, 0.20, 0.20),
    "seal": (0.72, 0.10, 0.12),
    "lens": (0.55, 0.70, 1.0),
    "gold": (0.95, 0.78, 0.25),
    "leather": (0.21, 0.055, 0.015),
    "leatherDark": (0.085, 0.022, 0.006),
    "brass": (0.72, 0.46, 0.11),
    "brassLight": (0.90, 0.70, 0.30),
    "lining": (0.008, 0.016, 0.16),
    "plate": (0.89, 0.72, 0.33),
}
MATS = {}

def mat(name, rough=0.6, alpha=None, metal=0.0, emit=None, vertex=False):
    key = (name, rough, alpha, metal, emit, vertex)
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(("V_" if vertex else "") + name + ("Glass" if alpha is not None else ""))
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    r, g, b = COL[name]
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if vertex:
        ca = nt.nodes.new("ShaderNodeVertexColor")
        ca.layer_name = "Col"
        nt.links.new(ca.outputs["Color"], bsdf.inputs["Base Color"])
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

FEATHER = mat("white", 0.85, vertex=True)  # colour comes from COLOR_0

# ---------------------------------------------------------------- helpers
def lerp3(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)

def empty(name, loc, parent=None, rot=None):
    o = bpy.data.objects.new(name, None)
    o.location = loc
    if rot is not None:
        o.rotation_euler = rot
    scene.collection.objects.link(o)
    if parent:
        o.parent = parent
    return o

def rel(loc, parent):
    return tuple(Vector(loc) - Vector(parent.location))

def finish(o, parent, name, smooth=False):
    o.name = name
    o.data.name = name
    if parent:
        o.parent = parent
    for p in o.data.polygons:
        p.use_smooth = smooth
    return o

def new_obj(name, bm, m, parent, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    me.materials.append(m)
    return finish(o, parent, name, smooth)

def sphere(name, loc, scale, m, parent=None, seg=16, rings=10, rot=None, smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1.0, location=loc)
    o = bpy.context.active_object
    o.scale = scale
    if rot is not None:
        o.rotation_euler = rot
    o.data.materials.append(m)
    return finish(o, parent, name, smooth)

def cone(name, loc, r1, r2, depth, m, parent=None, rot=None, verts=8, scale=None, smooth=False):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc)
    o = bpy.context.active_object
    if rot is not None:
        o.rotation_euler = rot
    if scale is not None:
        o.scale = scale
    o.data.materials.append(m)
    return finish(o, parent, name, smooth)

def cylinder(name, loc, r, depth, m, parent=None, rot=None, verts=12, smooth=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc)
    o = bpy.context.active_object
    if rot is not None:
        o.rotation_euler = rot
    o.data.materials.append(m)
    return finish(o, parent, name, smooth)

def torus(name, loc, major, minor, m, parent=None, rot=None, seg=20, rings=6):
    bpy.ops.mesh.primitive_torus_add(major_segments=seg, minor_segments=rings, major_radius=major, minor_radius=minor, location=loc)
    o = bpy.context.active_object
    if rot is not None:
        o.rotation_euler = rot
    o.data.materials.append(m)
    return finish(o, parent, name, True)

def box(name, loc, size, m, parent=None, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object
    o.scale = size
    if rot is not None:
        o.rotation_euler = rot
    o.data.materials.append(m)
    return finish(o, parent, name, False)

def cylinder_between(name, a, b, r, m, parent=None, verts=6):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    o.data.materials.append(m)
    return finish(o, parent, name, True)

def loft(name, rings, m, parent, seg=16, cap=True, smooth=True):
    """Tube through elliptical cross-sections. rings: [(t, w, d, ox, oy)] along Z."""
    bm = bmesh.new()
    loops = []
    for (t, w, d, ox, oy) in rings:
        vs = []
        for i in range(seg):
            a = 2 * math.pi * (i + 0.5) / seg
            vs.append(bm.verts.new((ox + math.cos(a) * w, oy + math.sin(a) * d, t)))
        loops.append(vs)
    for a, b in zip(loops[:-1], loops[1:]):
        for i in range(seg):
            bm.faces.new((a[i], a[(i + 1) % seg], b[(i + 1) % seg], b[i]))
    if cap:
        bm.faces.new(list(reversed(loops[0])))
        bm.faces.new(loops[-1])
    bm.normal_update()
    return new_obj(name, bm, m, parent, smooth)

def blades(name, specs, parent, seg=6, rings=4, smooth=False):
    """One mesh of flat leaf-shaped blades (vertex-coloured).
    specs: [(base, tip, width, thickness, c_base, c_tip[, normal])] in the parent's local space."""
    bm = bmesh.new()
    col = bm.verts.layers.float_color.new("Col")
    for spec in specs:
        base, tip, wd, th, cb, ct = spec[:6]
        nrm = Vector(spec[6]) if len(spec) > 6 else Vector((0, -1, 0))
        base, tip = Vector(base), Vector(tip)
        d = tip - base
        L = d.length
        z = d.normalized()
        y = nrm - z * nrm.dot(z)
        y = y.normalized() if y.length > 1e-4 else z.orthogonal()
        x = y.cross(z).normalized()
        R = Matrix((x, y, z)).transposed()
        geom = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
        for v in geom["verts"]:
            t = (v.co.z + 1) / 2
            w = math.sin(math.pi * min(1.0, t ** 0.7)) ** 0.8
            p = Vector((v.co.x * wd * w, v.co.y * th * (0.4 + 0.6 * w), t * L))
            v.co = base + R @ p
            v[col] = (*lerp3(cb, ct, t * t), 1.0)
    bm.normal_update()
    return new_obj(name, bm, FEATHER, parent, smooth)

def paint(obj, fn):
    me = obj.data
    if "Col" not in me.color_attributes:
        me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
    attr = me.color_attributes["Col"]
    for i, v in enumerate(me.vertices):
        r, g, b = fn(v.co)
        attr.data[i].color = (r, g, b, 1.0)

def wrap_shape(name, pts, m, parent, target, offset, thickness=0.02, levels=2):
    """Flat polygon (x,z) projected onto `target` along Y and solidified — lapels, shirt, tie."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, -1.0, z)) for x, z in pts]
    bm.faces.new(vs)
    o = new_obj(name, bm, m, parent, smooth=True)
    sub = o.modifiers.new("sub", "SUBSURF")
    sub.subdivision_type = "SIMPLE"
    sub.levels = levels
    sub.render_levels = levels
    sw = o.modifiers.new("wrap", "SHRINKWRAP")
    sw.target = target
    sw.wrap_method = "PROJECT"
    sw.use_project_y = True
    sw.use_positive_direction = True
    sw.use_negative_direction = True
    sw.offset = offset
    so = o.modifiers.new("solid", "SOLIDIFY")
    so.thickness = thickness
    so.offset = -1
    return o

# ---------------------------------------------------------------- root
root = empty("Owl", (0, 0, 0))

# ================================================================ BODY
BODY_P = Vector((0, 0, 0.78))
body = empty("Body", BODY_P, root)
jacket = loft("Jacket", [
    (-0.62, 0.60, 0.50, 0, 0.0),
    (-0.30, 0.60, 0.50, 0, 0.0),
    (0.05, 0.58, 0.47, 0, 0.0),
    (0.32, 0.64, 0.44, 0, 0.01),
    (0.46, 0.73, 0.41, 0, 0.03),
    (0.53, 0.60, 0.34, 0, 0.03),
    (0.58, 0.30, 0.24, 0, 0.02),
], mat("navy", 0.72), body, seg=18)
loft("Pants", [(-0.78, 0.44, 0.36, 0, 0), (-0.64, 0.50, 0.42, 0, 0), (-0.40, 0.52, 0.44, 0, 0), (-0.28, 0.50, 0.43, 0, 0)],
     mat("pants", 0.85), body, seg=14)
wrap_shape("Shirt", [(-0.22, 0.56), (0.22, 0.56), (0.0, -0.10)], mat("white", 0.6), body, jacket, 0.008, 0.015, levels=2)
for s, nm in ((1, "L"), (-1, "R")):
    wrap_shape("Lapel" + nm, [(s * 0.04, 0.56), (s * 0.30, 0.50), (s * 0.36, 0.34), (s * 0.24, 0.10), (s * 0.08, -0.16)], mat("navyDark", 0.72), body, jacket, 0.02, 0.03, levels=2)
    box("Collar" + nm, rel((s * 0.13, -0.33, 1.34), body), (0.16, 0.05, 0.13), mat("white", 0.6), body,
        rot=Euler((math.radians(-25), s * math.radians(-40), s * math.radians(22))))
box("TieKnot", rel((0, -0.42, 1.26), body), (0.13, 0.09, 0.10), mat("tie", 0.5), body)
wrap_shape("Tie", [(-0.045, 0.40), (0.045, 0.40), (0.085, 0.10), (0.0, -0.36), (-0.085, 0.10)], mat("tie", 0.5), body, jacket, 0.03, 0.028, levels=1)
for i, z in enumerate((0.64, 0.50)):
    sphere(f"Button{i}", rel((0.0, -0.55, z), body), (0.03, 0.02, 0.03), mat("black", 0.4), body, seg=8, rings=4)
wrap_shape("Pocket", [(-0.40, 0.29), (-0.24, 0.29), (-0.30, 0.40), (-0.36, 0.36)], mat("white", 0.6), body, jacket, 0.03, 0.015, levels=1)
sphere("Pin", rel((0.30, -0.48, 1.06), body), (0.032, 0.02, 0.032), mat("gold", 0.3, metal=0.8), body, seg=8, rings=4)

# ================================================================ HEAD
HEAD_P = Vector((0, 0, 1.22))
HEAD_C = Vector((0, 0, 1.68))
HEAD_S = Vector((0.72, 0.58, 0.54))
head = empty("Head", HEAD_P, root)

bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=1.0, location=rel(HEAD_C, head))
hm = bpy.context.active_object
LOBE_L = Vector((0.36, -0.86, -0.06)).normalized()
LOBE_R = Vector((-0.36, -0.86, -0.06)).normalized()
def disc_fields(p):
    n = p.normalized()
    a = min(math.acos(max(-1, min(1, n.dot(LOBE_L)))), math.acos(max(-1, min(1, n.dot(LOBE_R)))))
    disc = smoothstep(0.78, 0.60, a)
    rim = smoothstep(0.60, 0.74, a) * (1 - smoothstep(0.80, 0.98, a))
    front = -n.y
    zc = 0.34 + 0.62 * abs(n.x)
    brow = smoothstep(0.24, 0.04, abs(n.z - zc)) * smoothstep(0.25, 0.55, front) * (1 - smoothstep(0.62, 0.8, abs(n.x)))
    return disc, rim, brow
for v in hm.data.vertices:
    disc, rim, brow = disc_fields(v.co)
    v.co = v.co * (1.0 + 0.075 * disc - 0.02 * rim + 0.03 * brow)
def head_color(p):
    disc, rim, brow = disc_fields(p)
    n = p.normalized()
    base = lerp3(COL["feather"], COL["featherLight"], 0.3 + 0.3 * n.z)
    c = lerp3(base, COL["rust"], rim)
    c = lerp3(c, COL["cream"], disc)
    c = lerp3(c, COL["creamLight"], disc * disc * 0.6)
    c = lerp3(c, COL["featherDark"], brow)
    return c
paint(hm, head_color)
hm.scale = HEAD_S
hm.data.materials.append(FEATHER)
finish(hm, head, "HeadMesh", True)

def on_head(n):
    n = Vector(n).normalized()
    disc, rim, brow = disc_fields(n)
    p = Vector((n.x * HEAD_S.x, n.y * HEAD_S.y, n.z * HEAD_S.z)) * (1.0 + 0.075 * disc - 0.02 * rim + 0.03 * brow)
    return Vector(rel(HEAD_C, head)) + p

# one dark flat brow blade per side, from between the eyes up towards the tuft
for s, nm in ((1, "L"), (-1, "R")):
    a = on_head(Vector((s * 0.10, -0.88, 0.42)))
    b = on_head(Vector((s * 0.58, -0.52, 0.74)))
    n = (a - Vector(rel(HEAD_C, head))).normalized()
    blades("Brow" + nm, [(a + n * 0.015, b + n * 0.045, 0.16, 0.03, COL["featherDark"], COL["featherDark"], n)], head)

# ear tufts: 4 flat blades per side sweeping up and outward
for s, nm in ((1, "L"), (-1, "R")):
    base = on_head(Vector((s * 0.62, -0.18, 0.78)))
    t = empty("Tuft" + nm, base, head)
    specs = []
    for k in range(4):
        ang = math.radians(16 + k * 13)
        back = math.radians(-6 + k * 7)
        L = 0.60 - abs(k - 1.5) * 0.09
        d = Vector((s * math.sin(ang), math.sin(back) * 0.6, math.cos(ang))).normalized()
        off = Vector((s * (k - 1.5) * 0.04, (k - 1.5) * 0.025, 0))
        cb = COL["feather"] if k % 2 else COL["featherLight"]
        specs.append((off, off + d * L, 0.13, 0.03, cb, COL["featherDark"], Vector((0, -1, 0.2))))
    blades("TuftMesh" + nm, specs, t)

# eyes
EYE_R = 0.20
for s, nm in ((1, "L"), (-1, "R")):
    ec = Vector((s * 0.225, -0.585, 1.66))
    e = empty("Eye" + nm, rel(ec, head), head)
    sphere("Sclera" + nm, (0, 0, 0), (EYE_R, EYE_R, EYE_R), mat("sclera", 0.12), e, seg=18, rings=12)
    sphere("Iris" + nm, (0, -EYE_R * 0.86, 0), (0.15, 0.05, 0.15), mat("amber", 0.3), e, seg=14, rings=6)
    sphere("Pupil" + nm, (0, -EYE_R * 1.0, -0.01), (0.088, 0.028, 0.088), mat("pupil", 0.15), e, seg=12, rings=6)
    sphere("Shine" + nm, (s * -0.045, -EYE_R * 1.07, 0.055), (0.03, 0.012, 0.03), mat("sclera", 0.1, emit="sclera"), e, seg=8, rings=4)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=12, radius=EYE_R * 1.08, location=rel(ec, head))
    lid = bpy.context.active_object
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(lid.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > -0.03], context="VERTS")
    bmesh.update_edit_mesh(lid.data)
    bpy.ops.object.mode_set(mode="OBJECT")
    lid.data.materials.append(FEATHER)
    paint(lid, lambda p: COL["cream"])
    so = lid.modifiers.new("solid", "SOLIDIFY")
    so.thickness = 0.025
    so.offset = 1
    finish(lid, head, "Lid" + nm, True)
    lid.rotation_euler = Euler((math.radians(-78), 0, 0))

# beak
beak = empty("Beak", rel((0, -0.66, 1.56), head), head)
cone("BeakMesh", (0, -0.03, -0.13), 0.10, 0.02, 0.32, mat("orange", 0.3), beak, rot=Euler((math.radians(160), 0, 0)), verts=8, scale=(1.0, 0.8, 1.0), smooth=True)
sphere("BeakBase", (0, 0.0, 0.0), (0.105, 0.085, 0.075), mat("orange", 0.3), beak, seg=10, rings=6)

# glasses
GL_Y = -0.80
glasses = empty("Glasses", rel((0, GL_Y, 1.665), head), head)
for s, nm in ((1, "L"), (-1, "R")):
    torus("Rim" + nm, (s * 0.225, 0, 0), 0.215, 0.024, mat("black", 0.3), glasses, rot=Euler((math.radians(90), 0, 0)), seg=22, rings=6)
    bpy.ops.mesh.primitive_circle_add(vertices=22, radius=0.22, fill_type="NGON", location=(s * 0.225, 0.005, 0))
    lens = bpy.context.active_object
    lens.rotation_euler = Euler((math.radians(90), 0, 0))
    lens.data.materials.append(mat("lens", 0.05, alpha=0.14))
    finish(lens, glasses, "Lens" + nm, False)
    cylinder_between("Arm" + nm, (s * 0.45, 0.0, 0.02), (s * 0.60, 0.66, 0.10), 0.017, mat("black", 0.3), glasses)
    cylinder_between("ArmTip" + nm, (s * 0.60, 0.66, 0.10), (s * 0.56, 0.76, -0.02), 0.017, mat("black", 0.3), glasses)
cylinder_between("Bridge", (-0.03, 0.0, 0.03), (0.03, 0.0, 0.03), 0.02, mat("black", 0.3), glasses)

# ================================================================ WINGS (arms)
for s, nm in ((1, "L"), (-1, "R")):
    shoulder = Vector((s * 0.60, -0.02, 1.16))
    hand_target = Vector((s * 0.46, -0.60, 0.46))
    d = hand_target - shoulder
    w = empty("Wing" + nm, shoulder, root)
    w.rotation_mode = "QUATERNION"
    w.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(d.normalized())
    L = d.length
    loft("Sleeve" + nm, [(0.06, 0.22, 0.20, 0, 0), (-0.05, 0.235, 0.21, 0, 0), (-0.32, 0.20, 0.185, 0, -0.01),
                         (-0.58, 0.175, 0.165, 0, -0.02), (-L * 0.93, 0.155, 0.15, 0, 0), (-L * 0.97, 0.15, 0.145, 0, 0)],
         mat("navy", 0.72), w, seg=12)
    cylinder("Cuff" + nm, (0, 0, -L * 0.965), 0.15, 0.05, mat("white", 0.6), w, verts=12)
    hand = empty("Hand" + nm, (0, 0, -L - 0.03), w)
    specs = [((0, 0.03, 0.16), (0, 0.03, -0.18), 0.16, 0.12, COL["hand"], COL["hand"], (0, 1, 0))]
    for i, (fx, fy) in enumerate(((-0.09, -0.02), (0.0, -0.03), (0.09, -0.02))):
        specs.append(((fx, fy, 0.02), (fx * 1.2, fy - 0.19, -0.12), 0.075, 0.06, COL["hand"], COL["featherDark"], (0, 1, 0)))
    specs.append(((s * 0.11, 0.05, 0.02), (s * 0.08, -0.14, 0.07), 0.065, 0.055, COL["hand"], COL["featherDark"], (1, 0, 0)))
    blades("Mitt" + nm, specs, hand, seg=8, rings=5, smooth=True)
    feathers = empty("Feathers" + nm, (0, 0, -L * 0.82), w)
    specs = []
    for i in range(6):
        a = math.radians(-40 + i * 16)
        fl = 0.60 + 0.14 * (1 - abs(i - 2.5) / 2.5)
        d2 = Vector((s * -math.sin(a), 0, -math.cos(a)))
        cb = COL["feather"] if i % 2 else COL["featherLight"]
        specs.append(((0, 0, 0), d2 * fl, 0.09, 0.025, cb, COL["featherDark"]))
    blades("FeatherFan" + nm, specs, feathers)
    feathers.scale = (0.001, 0.001, 0.001)

# ================================================================ TALONS
for s, nm in ((1, "L"), (-1, "R")):
    t = empty("Talon" + nm, (s * 0.20, -0.05, 0.16), root)
    sphere("Foot" + nm, (0, -0.06, -0.10), (0.13, 0.17, 0.07), mat("orange", 0.5), t, seg=10, rings=6)
    for i, (tx, ty) in enumerate(((-0.09, -0.24), (0.0, -0.28), (0.09, -0.24))):
        sphere(f"Toe{nm}{i}", (tx, ty, -0.12), (0.042, 0.10, 0.036), mat("orange", 0.5), t, seg=8, rings=5)
        cone(f"Claw{nm}{i}", (tx, ty - 0.12, -0.14), 0.022, 0.0, 0.07, mat("black", 0.4), t, rot=Euler((math.radians(100), 0, 0)), verts=5)
    sphere(f"ToeBack{nm}", (0, 0.10, -0.12), (0.04, 0.07, 0.03), mat("orange", 0.5), t, seg=8, rings=4)

# ================================================================ BRIEFCASE (replaces the paper)
def colored_boxes(name, parts, parent, bevel=0.0):
    """One vertex-coloured mesh out of several boxes: parts = [(center, size, color[, rot_euler])] (local)."""
    bm = bmesh.new()
    col = bm.verts.layers.float_color.new("Col")
    for part in parts:
        c, sz, color = part[:3]
        rot = Euler(part[3]) if len(part) > 3 else None
        geom = bmesh.ops.create_cube(bm, size=1.0)
        verts = geom["verts"]
        M = Matrix.Translation(Vector(c)) @ (rot.to_matrix().to_4x4() if rot else Matrix.Identity(4)) @ Matrix.Diagonal((sz[0], sz[1], sz[2], 1.0))
        for v in verts:
            v.co = M @ v.co
            v[col] = (*color, 1.0)
        if bevel > 0 and len(part) < 5:
            edges = [e for e in bm.edges if e.verts[0] in verts and e.verts[1] in verts]
            bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=1, affect="EDGES")
    bm.normal_update()
    return new_obj(name, bm, FEATHER, parent, smooth=False)

CASE_C = Vector((0, -0.70, 0.50))
CW, CH, CD = 0.92, 0.42, 0.24      # body: width, height (below the hinge), depth
LID_H = 0.16
case = empty("Briefcase", CASE_C, root)
case.rotation_euler = Euler((math.radians(-10), 0, 0))
# body: leather box with a slightly darker bottom band, front plate, corner protectors, clasps, handle
parts = [
    ((0, 0, -CH / 2), (CW, CD, CH), COL["leather"]),
    ((0, 0, -CH + 0.03), (CW + 0.004, CD + 0.004, 0.06), COL["leatherDark"], (0, 0, 0), "nobevel"),
    # brass plate with a dark engraved line ("GURÚ SOLUCIONES")
    ((0, -CD / 2 - 0.006, -CH * 0.42), (0.34, 0.012, 0.09), COL["plate"], (0, 0, 0), "nobevel"),
    ((0, -CD / 2 - 0.013, -CH * 0.42), (0.26, 0.004, 0.022), COL["black"], (0, 0, 0), "nobevel"),
]
# corner protectors (bottom front/back corners)
for sx in (-1, 1):
    for sy in (-1, 1):
        parts.append(((sx * (CW / 2 - 0.035), sy * (CD / 2 - 0.02), -CH + 0.045), (0.07, 0.05, 0.09), COL["brass"], (0, 0, 0), "nobevel"))
# clasps on the front top edge of the body
for sx in (-1, 1):
    parts.append(((sx * 0.30, -CD / 2 - 0.012, -0.03), (0.09, 0.025, 0.06), COL["brassLight"], (0, 0, 0), "nobevel"))
# handle: five short segments along an arc above the lid, each aligned with the arc tangent
for i in range(5):
    a0 = math.pi * (0.12 + 0.76 * i / 5)
    a1 = math.pi * (0.12 + 0.76 * (i + 1) / 5)
    am = (a0 + a1) / 2
    r = 0.19
    cx, cz = math.cos(am) * r, LID_H + 0.015 + math.sin(am) * r * 0.6
    tx, tz = -math.sin(am) * r, math.cos(am) * r * 0.6
    seg = math.hypot(tx, tz) * (a1 - a0) * 1.08
    parts.append(((cx, 0, cz), (seg, 0.035, 0.035), COL["leatherDark"], (0, -math.atan2(tz, tx), 0), "nobevel"))
for sx in (-1, 1):
    parts.append(((sx * 0.19, 0, LID_H + 0.01), (0.05, 0.05, 0.04), COL["brass"], (0, 0, 0), "nobevel"))
colored_boxes("CaseBody", parts, case, bevel=0.015)
# blue lining at the open top of the body
colored_boxes("CaseLining", [((0, 0, -0.012), (CW - 0.03, CD - 0.03, 0.02), COL["lining"], (0, 0, 0), "nobevel")], case)
# lid, hinged at the back-top edge of the body (local +y is the back)
lid = empty("Lid", (0, CD / 2, 0), case)
colored_boxes("LidMesh", [
    ((0, -CD / 2, LID_H / 2), (CW, CD, LID_H), COL["leather"]),
    ((0, -CD / 2, 0.006), (CW - 0.03, CD - 0.03, 0.012), COL["lining"], (0, 0, 0), "nobevel"),
    ((0, -CD - 0.006, LID_H * 0.5), (0.36, 0.012, 0.05), COL["brass"], (0, 0, 0), "nobevel"),
], lid, bevel=0.015)
# document inside: a parchment sheet that rises out of the case
cdoc = empty("CaseDocument", (0, 0.02, -CH + 0.03), case)
colored_boxes("CaseSheet", [
    ((0, 0, 0.17), (0.62, 0.012, 0.34), COL["paper"], (0, 0, 0), "nobevel"),
    ((-0.08, -0.009, 0.29), (0.30, 0.004, 0.02), COL["inkLine"], (0, 0, 0), "nobevel"),
    ((0.0, -0.009, 0.24), (0.46, 0.004, 0.012), COL["inkLine"], (0, 0, 0), "nobevel"),
    ((0.0, -0.009, 0.20), (0.46, 0.004, 0.012), COL["inkLine"], (0, 0, 0), "nobevel"),
    ((0.18, -0.009, 0.12), (0.09, 0.004, 0.09), COL["seal"], (0, 0, 0), "nobevel"),
], cdoc)

# ---------------------------------------------------------------- finish
bpy.ops.object.select_all(action="DESELECT")
print("meshes:", sum(1 for o in scene.objects if o.type == "MESH"))
dg = bpy.context.evaluated_depsgraph_get()
tris = 0
lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
for o in scene.objects:
    if o.type != "MESH":
        continue
    ev = o.evaluated_get(dg)
    tris += sum(len(p.vertices) - 2 for p in ev.data.polygons)
    if o.name.startswith("FeatherFan"):
        continue
    if o.name.startswith("Case") or o.name == "LidMesh":
        print("  case part", o.name, sum(len(p.vertices) - 2 for p in ev.data.polygons))
    for v in ev.data.vertices:
        p = ev.matrix_world @ v.co
        lo.x, lo.y, lo.z = min(lo.x, p.x), min(lo.y, p.y), min(lo.z, p.z)
        hi.x, hi.y, hi.z = max(hi.x, p.x), max(hi.y, p.y), max(hi.z, p.z)
print("triangles:", tris)
print("bounds min", tuple(round(v, 3) for v in lo), "max", tuple(round(v, 3) for v in hi))

kw = dict(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True, export_animations=False, export_skins=False,
          export_morph=False, export_cameras=False, export_lights=False, export_extras=False, export_texcoords=False, export_normals=True)
try:
    bpy.ops.export_scene.gltf(**kw, export_vertex_color="MATERIAL", export_all_vertex_colors=False)
except TypeError:
    bpy.ops.export_scene.gltf(**kw)
print("wrote", OUT)

# ---------------------------------------------------------------- preview render(s)
if PREVIEW:
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
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
    light("Key", "AREA", (3.0, -4.5, 4.0), 260, (1.0, 0.95, 0.88), 3.0)
    light("Fill", "AREA", (-4.0, -3.5, 1.5), 110, (0.75, 0.82, 1.0), 4.0)
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
    scene.render.image_settings.file_format = "PNG"
    views = [("", (0.0, -6.4, 1.35), (88, 0, 0))]
    if VIEWS:
        views += [("_34", (-4.2, -4.8, 1.6), (86, 0, -41)), ("_face", (0.0, -3.4, 1.62), (90, 0, 0))]
    for suffix, loc, rot in views:
        cam.location = loc
        cam.rotation_euler = Euler(tuple(math.radians(a) for a in rot))
        if suffix == "_face":
            cam_data.lens = 85
        scene.render.filepath = PREVIEW.replace(".png", suffix + ".png")
        bpy.ops.render.render(write_still=True)
        print("preview", scene.render.filepath)
