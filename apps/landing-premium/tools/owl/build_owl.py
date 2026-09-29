"""Gurú Soluciones owl mascot — procedural Blender build (headless), v2 "Pixar pass".

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python build_owl.py -- \
      --out /path/owl_raw.glb [--preview /path/preview.png] [--views]

Blender is Z-up and the owl faces -Y; the glTF exporter converts to Y-up so in
three.js the owl faces +Z (towards the default camera).

Node hierarchy (all names are stable and used by src/three/owl/OwlRig.tsx):
  Owl
   ├ Body           (lofted jacket with squared shoulders, pants, shirt, collar, lapels, tie + knot, pocket square, buttons)
   ├ Head           pivot at the neck
   │   ├ HeadMesh   one sculpted sphere: facial disc bulge + vertex-colour gradient (cream disc, rusty rim, dark V brow)
   │   ├ BrowL/R, CheekFluffL/R, ChinFluff, Crown   feather strand bundles (vertex colours)
   │   ├ TuftL / TuftR       pivot at the base of each ear tuft; flame-shaped strand bundles
   │   ├ EyeL / EyeR         pivot at the eye centre (sclera + iris + pupil + highlights)
   │   ├ LidL / LidR         spherical cap, pivot at the eye centre; rotation.x 0 = closed, rest = half-open (sleepy)
   │   ├ Beak
   │   └ Glasses             (rings, bridge, arms, LensL / LensR)
   ├ WingL / WingR   pivot at the shoulder; lofted sleeve + cuff + fluffy mitt; FeathersL/R fan inside (scale 0.001)
   ├ TalonL / TalonR pivot at the ankle
   └ Document        pivot at the sheet centre (parchment + text lines + seal)
Feather parts share one white "Feather" material driven by vertex colours (COLOR_0 in the GLB).
"""
import sys, math
import bpy, bmesh
from mathutils import Vector, Euler, Matrix, Quaternion

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
    "feather": (0.26, 0.125, 0.045),
    "featherLight": (0.46, 0.27, 0.12),
    "featherDark": (0.16, 0.075, 0.03),
    "cream": (0.74, 0.56, 0.32),
    "creamDeep": (0.58, 0.41, 0.21),
    "rust": (0.62, 0.24, 0.06),
    "navy": (0.035, 0.055, 0.21),
    "navyDark": (0.02, 0.03, 0.13),
    "pants": (0.045, 0.05, 0.10),
    "white": (0.95, 0.95, 0.93),
    "tie": (0.42, 0.07, 0.13),
    "tieDark": (0.25, 0.04, 0.08),
    "hand": (0.40, 0.21, 0.08),
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
}
MATS = {}

def mat(name, rough=0.55, alpha=None, metal=0.0, emit=None, vertex=False):
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

FEATHER = mat("white", 0.82, vertex=True)  # colour comes from COLOR_0

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

def finish(o, parent, name, smooth=True, subsurf=0):
    o.name = name
    o.data.name = name
    if parent:
        o.parent = parent
    if subsurf:
        s = o.modifiers.new("sub", "SUBSURF")
        s.levels = subsurf
        s.render_levels = subsurf
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    return o

def new_obj(name, bm, m, parent, subsurf=0, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    me.materials.append(m)
    return finish(o, parent, name, smooth, subsurf)

def sphere(name, loc, scale, m, parent=None, seg=32, rings=16, rot=None, subsurf=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1.0, location=loc)
    o = bpy.context.active_object
    o.scale = scale
    if rot is not None:
        o.rotation_euler = rot
    o.data.materials.append(m)
    return finish(o, parent, name, True, subsurf)

def cone(name, loc, r1, r2, depth, m, parent=None, rot=None, verts=24, scale=None, subsurf=0):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc)
    o = bpy.context.active_object
    if rot is not None:
        o.rotation_euler = rot
    if scale is not None:
        o.scale = scale
    o.data.materials.append(m)
    return finish(o, parent, name, True, subsurf)

def cylinder(name, loc, r, depth, m, parent=None, rot=None, verts=16, subsurf=0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc)
    o = bpy.context.active_object
    if rot is not None:
        o.rotation_euler = rot
    o.data.materials.append(m)
    return finish(o, parent, name, True, subsurf)

def torus(name, loc, major, minor, m, parent=None, rot=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=48, minor_segments=12, major_radius=major, minor_radius=minor, location=loc)
    o = bpy.context.active_object
    if rot is not None:
        o.rotation_euler = rot
    o.data.materials.append(m)
    return finish(o, parent, name, True)

def box(name, loc, size, m, parent=None, rot=None, subsurf=0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object
    o.scale = size
    if rot is not None:
        o.rotation_euler = rot
    o.data.materials.append(m)
    return finish(o, parent, name, subsurf > 0, subsurf)

def cylinder_between(name, a, b, r, m, parent=None, verts=12):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    o.data.materials.append(m)
    return finish(o, parent, name, True)

def loft(name, rings, m, parent, seg=28, subsurf=2, cap=True, axis="Z"):
    """Smooth tube through elliptical cross-sections. rings: [(t, w, d, ox, oy)] — t along the axis,
    w/d the half-widths, ox/oy the offset of the section centre. Sections are bridged and capped."""
    bm = bmesh.new()
    loops = []
    for (t, w, d, ox, oy) in rings:
        vs = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            x, y = ox + math.cos(a) * w, oy + math.sin(a) * d
            if axis == "Z":
                vs.append(bm.verts.new((x, y, t)))
            else:  # along -Z for sleeves: t goes negative
                vs.append(bm.verts.new((x, y, t)))
        loops.append(vs)
    for a, b in zip(loops[:-1], loops[1:]):
        for i in range(seg):
            bm.faces.new((a[i], a[(i + 1) % seg], b[(i + 1) % seg], b[i]))
    if cap:
        bm.faces.new(list(reversed(loops[0])))
        bm.faces.new(loops[-1])
    bm.normal_update()
    return new_obj(name, bm, m, parent, subsurf)

def strands(name, specs, parent, subsurf=1, seg=10, rings=9):
    """One mesh made of many flat, leaf-shaped feather strands (vertex-coloured).
    specs: [(base(3), tip(3), width, thickness, c_base(3), c_tip(3)[, normal(3)])] in the parent's local space.
    The strand's flat side faces `normal` (so feathers lie on the body instead of sticking out)."""
    bm = bmesh.new()
    col = bm.verts.layers.float_color.new("Col")
    for spec in specs:
        base, tip, wd, th, cb, ct = spec[:6]
        nrm = Vector(spec[6]) if len(spec) > 6 else Vector((0, -1, 0))
        base, tip = Vector(base), Vector(tip)
        d = tip - base
        L = d.length
        z = d.normalized()
        y = (nrm - z * nrm.dot(z))
        y = y.normalized() if y.length > 1e-4 else z.orthogonal()
        x = y.cross(z).normalized()
        R = Matrix((x, y, z)).transposed()
        geom = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
        for v in geom["verts"]:
            t = (v.co.z + 1) / 2
            # leaf profile: widest at ~40% of the length, pointed tip, rounded base
            w = math.sin(math.pi * min(1.0, t ** 0.75)) ** 0.7
            p = Vector((v.co.x * wd * w, v.co.y * th * (0.4 + 0.6 * w), t * L))
            v.co = base + R @ p
            v[col] = (*lerp3(cb, ct, t * t), 1.0)
    bm.normal_update()
    return new_obj(name, bm, FEATHER, parent, subsurf)

def paint(obj, fn):
    """Vertex-colour an object: fn(local_co) -> (r,g,b)."""
    me = obj.data
    if "Col" not in me.color_attributes:
        me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
    attr = me.color_attributes["Col"]
    for i, v in enumerate(me.vertices):
        r, g, b = fn(v.co)
        attr.data[i].color = (r, g, b, 1.0)

def set_active(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o

# ---------------------------------------------------------------- root
root = empty("Owl", (0, 0, 0))

# ================================================================ BODY
BODY_P = Vector((0, 0, 0.78))
body = empty("Body", BODY_P, root)
# jacket: lofted silhouette with a flared hem and squared shoulders (body-local z)
jacket = loft("Jacket", [
    (-0.62, 0.60, 0.50, 0, 0.0),
    (-0.40, 0.60, 0.50, 0, 0.0),
    (-0.10, 0.57, 0.48, 0, 0.0),
    (0.20, 0.60, 0.46, 0, 0.0),
    (0.40, 0.70, 0.42, 0, 0.02),
    (0.47, 0.72, 0.40, 0, 0.03),
    (0.52, 0.56, 0.34, 0, 0.03),
    (0.58, 0.30, 0.24, 0, 0.02),
], mat("navy", 0.72), body, seg=32, subsurf=2)
# pants / lower body
loft("Pants", [
    (-0.78, 0.44, 0.36, 0, 0), (-0.66, 0.50, 0.42, 0, 0), (-0.50, 0.52, 0.44, 0, 0), (-0.30, 0.50, 0.43, 0, 0),
], mat("pants", 0.85), body, seg=24, subsurf=2)

def wrap_shape(name, pts, m, parent, target, offset, thickness=0.02, subsurf=2):
    """Flat polygon (x,z) projected onto `target` along Y, solidified and smoothed."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, -1.0, z)) for x, z in pts]
    bm.faces.new(vs)
    o = new_obj(name, bm, m, parent, 0, smooth=True)
    sub = o.modifiers.new("sub", "SUBSURF")
    sub.subdivision_type = "SIMPLE"
    sub.levels = 3
    sub.render_levels = 3
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
    if subsurf:
        s2 = o.modifiers.new("sub2", "SUBSURF")
        s2.levels = 1
        s2.render_levels = 1
    return o

# shirt front (white V) — sits just outside the jacket, the lapels cover its sides
wrap_shape("Shirt", [(-0.22, 0.56), (0.22, 0.56), (0.0, -0.10)], mat("white", 0.6), body, jacket, 0.008)
# lapels: wide at the shoulder, folding to the button at the waist; a second darker layer gives the fold
for s, nm in ((1, "L"), (-1, "R")):
    wrap_shape("Lapel" + nm, [(s * 0.04, 0.56), (s * 0.30, 0.50), (s * 0.36, 0.34), (s * 0.24, 0.10), (s * 0.08, -0.16)], mat("navyDark", 0.72), body, jacket, 0.02, 0.03)
    wrap_shape("LapelEdge" + nm, [(s * 0.05, 0.54), (s * 0.20, 0.49), (s * 0.30, 0.34), (s * 0.19, 0.12), (s * 0.08, -0.14)], mat("navy", 0.6), body, jacket, 0.036, 0.012, subsurf=0)
# shirt collar: two folded flaps at the neck
for s, nm in ((1, "L"), (-1, "R")):
    c = box("Collar" + nm, rel((s * 0.13, -0.33, 1.34), body), (0.16, 0.05, 0.13), mat("white", 0.6), body,
            rot=Euler((math.radians(-25), s * math.radians(-40), s * math.radians(22))), subsurf=2)
# tie: knot + blade
box("TieKnot", rel((0, -0.42, 1.26), body), (0.13, 0.09, 0.10), mat("tie", 0.5), body, subsurf=2)
wrap_shape("Tie", [(-0.045, 0.40), (0.045, 0.40), (0.085, 0.10), (0.0, -0.36), (-0.085, 0.10)], mat("tie", 0.5), body, jacket, 0.03, 0.028)
wrap_shape("TieStripe", [(-0.02, 0.36), (0.03, 0.36), (0.045, 0.10), (0.0, -0.30), (-0.045, 0.10)], mat("tieDark", 0.5), body, jacket, 0.046, 0.006, subsurf=0)
# buttons, pocket square (viewer's left = -x), gold pin
for i, z in enumerate((0.64, 0.50)):
    sphere(f"Button{i}", rel((0.0, -0.55, z), body), (0.03, 0.02, 0.03), mat("black", 0.4), body, seg=12, rings=6)
wrap_shape("PocketSlit", [(-0.42, 0.30), (-0.22, 0.30), (-0.22, 0.27), (-0.42, 0.27)], mat("navyDark", 0.7), body, jacket, 0.02, 0.02, subsurf=0)
wrap_shape("Pocket", [(-0.40, 0.29), (-0.24, 0.29), (-0.30, 0.40), (-0.36, 0.36)], mat("white", 0.6), body, jacket, 0.03, 0.015, subsurf=0)
sphere("Pin", rel((0.30, -0.48, 1.06), body), (0.032, 0.02, 0.032), mat("gold", 0.3, metal=0.8), body, seg=12, rings=6)

# ================================================================ HEAD
HEAD_P = Vector((0, 0, 1.22))
HEAD_C = Vector((0, 0, 1.68))
HEAD_S = Vector((0.72, 0.58, 0.54))
head = empty("Head", HEAD_P, root)

# sculpted head: unit sphere → facial-disc bulge + vertex colours, then scaled
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=40, radius=1.0, location=rel(HEAD_C, head))
hm = bpy.context.active_object
LOBE_L = Vector((0.36, -0.86, -0.06)).normalized()
LOBE_R = Vector((-0.36, -0.86, -0.06)).normalized()
def disc_fields(p):
    n = p.normalized()
    a = min(math.acos(max(-1, min(1, n.dot(LOBE_L)))), math.acos(max(-1, min(1, n.dot(LOBE_R)))))
    disc = smoothstep(0.80, 0.55, a)                    # 1 inside the disc
    rim = smoothstep(0.58, 0.78, a) * (1 - smoothstep(0.82, 1.08, a))  # ring just outside
    # V brow: a band that rises from between the eyes to the tufts (higher at the sides)
    front = -n.y
    zc = 0.34 + 0.62 * abs(n.x)
    brow = smoothstep(0.26, 0.0, abs(n.z - zc)) * smoothstep(0.25, 0.55, front) * (1 - smoothstep(0.62, 0.8, abs(n.x)))
    return disc, rim, brow
for v in hm.data.vertices:
    disc, rim, brow = disc_fields(v.co)
    bulge = 1.0 + 0.075 * disc - 0.02 * rim + 0.035 * brow
    v.co = v.co * bulge
def head_color(p):
    disc, rim, brow = disc_fields(p)
    n = p.normalized()
    base = lerp3(COL["feather"], COL["featherLight"], 0.25 + 0.25 * n.z)  # lighter crown
    c = lerp3(base, COL["rust"], rim)
    c = lerp3(c, COL["cream"], disc)
    c = lerp3(c, (0.88, 0.72, 0.48), disc * disc * 0.55)  # lighter disc centre
    # slightly deeper cream under the eyes / toward the beak centre
    c = lerp3(c, COL["creamDeep"], disc * smoothstep(0.35, 0.0, abs(n.x)) * 0.35)
    c = lerp3(c, COL["featherDark"], brow)
    return c
paint(hm, head_color)
hm.scale = HEAD_S
hm.data.materials.append(FEATHER)
finish(hm, head, "HeadMesh", True, 1)

def on_head(n):
    """A direction (unit) → point on the head surface, head-local."""
    n = Vector(n).normalized()
    disc, rim, brow = disc_fields(n)
    bulge = 1.0 + 0.075 * disc - 0.02 * rim + 0.035 * brow
    p = Vector((n.x * HEAD_S.x, n.y * HEAD_S.y, n.z * HEAD_S.z)) * bulge
    return Vector(rel(HEAD_C, head)) + p

# brow feathers: chained flat strands from between the eyes sweeping up to the tuft bases
for s, nm in ((1, "L"), (-1, "R")):
    specs = []
    pts = [Vector((s * 0.08, -0.90, 0.40)), Vector((s * 0.30, -0.80, 0.56)), Vector((s * 0.50, -0.62, 0.68)), Vector((s * 0.64, -0.42, 0.76))]
    for i in range(3):
        a, b = on_head(pts[i]), on_head(pts[i + 1])
        n = (a - Vector(rel(HEAD_C, head))).normalized()
        specs.append((a + n * 0.01, b + n * 0.035, 0.15 - i * 0.02, 0.03, COL["featherDark"], COL["featherDark"], n))
        specs.append((a + n * 0.02 + Vector((0, 0, -0.07)), b + n * 0.04 + Vector((0, 0, -0.03)), 0.11, 0.025, COL["featherDark"], COL["feather"], n))
    strands("Brow" + nm, specs, head)

# cheek fluff: flat feathers lying around the disc rim, pointing outward
for s, nm in ((1, "L"), (-1, "R")):
    lobe = LOBE_L if s > 0 else LOBE_R
    u = lobe.cross(Vector((0, 0, 1))).normalized()
    w = u.cross(lobe).normalized()
    specs = []
    for k in range(14):
        phi = math.radians(-105 + k * 17) * s  # from the chin side up to the outer cheek
        ang = 0.76
        n = (lobe * math.cos(ang) + (u * math.cos(phi) + w * math.sin(phi)) * math.sin(ang)).normalized()
        p = on_head(n)
        tangent = (u * math.cos(phi) + w * math.sin(phi))
        base = p - tangent * 0.02 + n * 0.01
        tip = p + tangent * 0.12 + n * 0.025
        c0 = COL["rust"] if k % 2 else COL["featherLight"]
        specs.append((base, tip, 0.07, 0.018, c0, COL["featherDark"] if k % 3 == 0 else COL["feather"], n))
    strands("CheekFluff" + nm, specs, head)

# chin / chest ruff: wide flat feathers lying on the upper chest
specs = []
for k in range(7):
    x = -0.30 + k * 0.10
    base = Vector(rel((x, -0.42 - 0.05 * math.cos(x * 3), 1.30), head))
    tip = base + Vector((x * 0.15, -0.04, -0.18))
    specs.append((base, tip, 0.085, 0.022, COL["cream"], COL["creamDeep"], Vector((0, -1, 0.35))))
strands("ChinFluff", specs, head)

# crown feathers: flat scales sweeping back over the top of the head
specs = []
for k in range(7):
    x = -0.30 + k * 0.10
    n1 = Vector((x * 1.2, -0.45, 0.85))
    base = on_head(n1)
    n = (base - Vector(rel(HEAD_C, head))).normalized()
    tip = on_head(Vector((x * 1.4, 0.05, 0.95))) + n * 0.03
    specs.append((base, tip, 0.10, 0.025, COL["featherLight"], COL["feather"], n))
strands("Crown", specs, head)

# ear tufts: flame-shaped bundles that sweep up and outward
for s, nm in ((1, "L"), (-1, "R")):
    base = on_head(Vector((s * 0.62, -0.18, 0.78)))
    t = empty("Tuft" + nm, base, head)
    specs = []
    for k in range(6):
        ang = math.radians(18 + k * 9)          # outward tilt
        back = math.radians(-8 + k * 6)         # slight backward sweep
        L = 0.62 - abs(k - 2.5) * 0.07
        d = Vector((s * math.sin(ang), math.sin(back) * 0.6, math.cos(ang))).normalized()
        off = Vector((s * (k - 2.5) * 0.028, (k - 2.5) * 0.02, 0))
        cb = COL["feather"] if k % 2 else COL["featherLight"]
        specs.append((off, off + d * L, 0.10, 0.03, cb, COL["featherDark"], Vector((0, -1, 0.2))))
    strands("TuftMesh" + nm, specs, t, subsurf=1)

# eyes: big, glossy, close together; resting lids give the wise sleepy look
EYE_R = 0.20
for s, nm in ((1, "L"), (-1, "R")):
    ec = Vector((s * 0.225, -0.585, 1.66))
    e = empty("Eye" + nm, rel(ec, head), head)
    sphere("Sclera" + nm, (0, 0, 0), (EYE_R, EYE_R, EYE_R), mat("sclera", 0.12), e, seg=40, rings=24)
    sphere("Iris" + nm, (0, -EYE_R * 0.86, 0), (0.15, 0.05, 0.15), mat("amber", 0.3), e, seg=32, rings=12)
    sphere("IrisRing" + nm, (0, -EYE_R * 0.90, 0), (0.15, 0.04, 0.15), mat("orangeDeep", 0.4), e, seg=32, rings=12)
    sphere("Pupil" + nm, (0, -EYE_R * 1.0, -0.01), (0.088, 0.028, 0.088), mat("pupil", 0.15), e, seg=24, rings=10)
    sphere("Shine" + nm, (s * -0.045, -EYE_R * 1.07, 0.055), (0.03, 0.012, 0.03), mat("sclera", 0.1, emit="sclera"), e, seg=12, rings=6)
    sphere("Shine2" + nm, (s * 0.03, -EYE_R * 1.06, -0.05), (0.014, 0.008, 0.014), mat("sclera", 0.1, emit="sclera"), e, seg=10, rings=5)
    # eyelid: front cap of a slightly bigger sphere; rotation.x = 0 closed, rest = -62° (half-open)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24, radius=EYE_R * 1.08, location=rel(ec, head))
    lid = bpy.context.active_object
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(lid.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > -0.03], context="VERTS")
    bmesh.update_edit_mesh(lid.data)
    bpy.ops.object.mode_set(mode="OBJECT")
    lid.data.materials.append(FEATHER)
    paint(lid, lambda p: lerp3(COL["creamDeep"], COL["cream"], 0.5 + 0.5 * (-p.y / (EYE_R * 1.08))))
    so = lid.modifiers.new("solid", "SOLIDIFY")
    so.thickness = 0.028
    so.offset = 1
    finish(lid, head, "Lid" + nm, True, 1)
    lid.rotation_euler = Euler((math.radians(-78), 0, 0))

# beak: rounded hook
beak = empty("Beak", rel((0, -0.66, 1.56), head), head)
cone("BeakMesh", (0, -0.03, -0.13), 0.10, 0.02, 0.32, mat("orange", 0.3), beak, rot=Euler((math.radians(160), 0, 0)), verts=16, scale=(1.0, 0.8, 1.0), subsurf=2)
sphere("BeakBase", (0, 0.0, 0.0), (0.105, 0.085, 0.075), mat("orange", 0.3), beak, seg=24, rings=12)

# glasses
GL_Y = -0.80
glasses = empty("Glasses", rel((0, GL_Y, 1.665), head), head)
for s, nm in ((1, "L"), (-1, "R")):
    torus("Rim" + nm, (s * 0.225, 0, 0), 0.215, 0.024, mat("black", 0.3), glasses, rot=Euler((math.radians(90), 0, 0)))
    bpy.ops.mesh.primitive_circle_add(vertices=48, radius=0.22, fill_type="NGON", location=(s * 0.225, 0.005, 0))
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
    hand_target = Vector((s * 0.24, -0.62, 0.42))
    d = hand_target - shoulder
    w = empty("Wing" + nm, shoulder, root)
    w.rotation_mode = "QUATERNION"
    w.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(d.normalized())
    L = d.length
    # sleeve: lofted along -Z with a squared shoulder cap and a slight elbow bend
    loft("Sleeve" + nm, [
        (0.06, 0.22, 0.20, 0, 0), (-0.05, 0.235, 0.21, 0, 0), (-0.30, 0.20, 0.185, 0, -0.01),
        (-0.55, 0.175, 0.165, 0, -0.02), (-L * 0.93, 0.155, 0.15, 0, 0), (-L * 0.97, 0.15, 0.145, 0, 0),
    ], mat("navy", 0.72), w, seg=24, subsurf=2)
    cylinder("Cuff" + nm, (0, 0, -L * 0.965), 0.15, 0.05, mat("white", 0.6), w, verts=24, subsurf=1)
    # fluffy mitt: palm + fused fingers + thumb, brown with darker tips (one strand-bundle mesh)
    hand = empty("Hand" + nm, (0, 0, -L - 0.03), w)
    specs = [((0, 0.03, 0.16), (0, 0.03, -0.18), 0.16, 0.12, COL["hand"], COL["hand"], (0, 1, 0))]
    for i, (fx, fy) in enumerate(((-0.09, -0.02), (0.0, -0.03), (0.09, -0.02))):
        specs.append(((fx, fy, 0.02), (fx * 1.2, fy - 0.19, -0.12), 0.075, 0.06, COL["hand"], COL["featherDark"], (0, 1, 0)))
    specs.append(((s * 0.11, 0.05, 0.02), (s * 0.08, -0.14, 0.07), 0.065, 0.055, COL["hand"], COL["featherDark"], (1, 0, 0)))
    strands("Mitt" + nm, specs, hand, subsurf=1, seg=14, rings=9)
    # flight feathers fan (scaled to ~0 in the file; the rig scales it up in flight)
    feathers = empty("Feathers" + nm, (0, 0, -L * 0.82), w)
    specs = []
    for i in range(7):
        a = math.radians(-42 + i * 14)
        fl = 0.60 + 0.14 * (1 - abs(i - 3) / 3)
        d2 = Vector((s * -math.sin(a), 0, -math.cos(a)))
        cb = COL["feather"] if i % 2 else COL["featherLight"]
        specs.append(((0, 0, 0), d2 * fl, 0.07, 0.025, cb, COL["featherDark"]))
    strands("FeatherFan" + nm, specs, feathers, subsurf=1)
    feathers.scale = (0.001, 0.001, 0.001)

# ================================================================ TALONS
for s, nm in ((1, "L"), (-1, "R")):
    t = empty("Talon" + nm, (s * 0.20, -0.05, 0.16), root)
    sphere("Foot" + nm, (0, -0.06, -0.10), (0.13, 0.17, 0.07), mat("orange", 0.5), t, seg=20, rings=10)
    for i, (tx, ty) in enumerate(((-0.09, -0.24), (0.0, -0.28), (0.09, -0.24))):
        sphere(f"Toe{nm}{i}", (tx, ty, -0.12), (0.042, 0.10, 0.036), mat("orange", 0.5), t, seg=14, rings=8)
        cone(f"Claw{nm}{i}", (tx, ty - 0.12, -0.14), 0.022, 0.0, 0.07, mat("black", 0.4), t, rot=Euler((math.radians(100), 0, 0)), verts=8, subsurf=1)
    sphere(f"ToeBack{nm}", (0, 0.10, -0.12), (0.04, 0.07, 0.03), mat("orange", 0.5), t, seg=12, rings=6)

# ================================================================ DOCUMENT
DOC_C = Vector((0, -0.66, 0.54))
DOC_W, DOC_H = 0.54, 0.66
doc = empty("Document", DOC_C, root)
doc.rotation_euler = Euler((math.radians(-18), 0, 0))
bm = bmesh.new()
NX, NZ = 12, 14
grid = []
for iz in range(NZ + 1):
    row = []
    for ix in range(NX + 1):
        x = -DOC_W / 2 + DOC_W * ix / NX
        z = -DOC_H / 2 + DOC_H * iz / NZ
        y = -0.03 * math.cos(x / DOC_W * math.pi) * (0.5 + 0.5 * math.cos(z / DOC_H * math.pi))
        y += 0.02 * math.sin(x / DOC_W * math.pi * 2) * (z / DOC_H)
        row.append(bm.verts.new((x, y, z)))
    grid.append(row)
for iz in range(NZ):
    for ix in range(NX):
        bm.faces.new((grid[iz][ix], grid[iz][ix + 1], grid[iz + 1][ix + 1], grid[iz + 1][ix]))
paper = new_obj("Paper", bm, mat("paper", 0.9), doc, 0)
so = paper.modifiers.new("solid", "SOLIDIFY")
so.thickness = 0.012
so.offset = 1
lines = [(0.34, 0.24, 0.022), (0.20, 0.17, 0.012), (0.44, 0.11, 0.012), (0.40, 0.06, 0.012), (0.44, 0.01, 0.012),
         (0.36, -0.04, 0.012), (0.44, -0.09, 0.012), (0.30, -0.14, 0.012), (0.24, -0.26, 0.012)]
for i, (w_, z, h) in enumerate(lines):
    x0 = -DOC_W / 2 + 0.07 + w_ / 2 if i else 0.0
    box(f"Line{i}", (x0, -0.045, z), (w_, 0.006, h), mat("inkLine", 0.8), doc)
cylinder("Seal", (0.15, -0.048, -0.23), 0.058, 0.006, mat("seal", 0.6), doc, rot=Euler((math.radians(90), 0, 0)), verts=24)
torus("SealRing", (0.15, -0.052, -0.23), 0.05, 0.006, mat("paper", 0.9), doc, rot=Euler((math.radians(90), 0, 0)))
box("Signature", (-0.06, -0.048, -0.27), (0.15, 0.006, 0.012), mat("inkLine", 0.8), doc, rot=Euler((0, math.radians(-8), 0)))

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
