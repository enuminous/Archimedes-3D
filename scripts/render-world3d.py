#!/usr/bin/env python3
"""Optional offscreen scene check using Mesa EGL and the actual JS geometry/shaders.
Requires Python, Pillow, Node and EGL/GLES libraries. This is not a browser test.
"""
import ctypes as C
import json
import os
import subprocess
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
os.environ.setdefault('EGL_PLATFORM', 'surfaceless')
data = json.loads(subprocess.check_output(['node', '-e', """
const A=require('./world3d/engine3d'),V=require('./world3d/renderer');
const w=A.step(A.createWorld('ARCHIMEDES-3D-001'),80),s=V.staticScene(A),d=V.dynamicScene(A,w,{field:true,trails:true,beliefs:true,targets:true});
const yaw=.7,pitch=.65,distance=34,target=[12,2.5,9],eye=target.map((v,i)=>v+[Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance][i]);
console.log(JSON.stringify({vertex:V.VERTEX,fragment:V.FRAGMENT,arrays:[s.tri,s.lines,d.tri,d.lines],eye,matrix:V.multiply(V.perspective(Math.PI/3.4,1280/900,.1,160),V.lookAt(eye,target)),checksum:A.checksum(w)}));
"""], cwd=root, text=True))
egl = C.CDLL('libEGL.so.1')
def bind(lib, name, restype, *argtypes):
    fn = getattr(lib, name); fn.restype = restype; fn.argtypes = argtypes; return fn
ptr, integer, uint, floating = C.c_void_p, C.c_int, C.c_uint, C.c_float
get_display = bind(egl, 'eglGetDisplay', ptr, ptr)
initialize = bind(egl, 'eglInitialize', uint, ptr, C.POINTER(integer), C.POINTER(integer))
choose = bind(egl, 'eglChooseConfig', uint, ptr, C.POINTER(integer), C.POINTER(ptr), integer, C.POINTER(integer))
create_surface = bind(egl, 'eglCreatePbufferSurface', ptr, ptr, ptr, C.POINTER(integer))
create_context = bind(egl, 'eglCreateContext', ptr, ptr, ptr, ptr, C.POINTER(integer))
make_current = bind(egl, 'eglMakeCurrent', uint, ptr, ptr, ptr, ptr)
get_proc = bind(egl, 'eglGetProcAddress', ptr, C.c_char_p)
def gl(name, restype, *args):
    address = get_proc(name.encode()); assert address, name
    return C.CFUNCTYPE(restype, *args)(address)
display = get_display(None); major = integer(); minor = integer()
assert initialize(display, C.byref(major), C.byref(minor)), 'EGL initialization failed'
assert bind(egl, 'eglBindAPI', uint, uint)(0x30A0), 'Cannot bind GLES'
attrs = (integer * 15)(0x3024,8,0x3023,8,0x3022,8,0x3025,24,0x3033,1,0x3040,4,0x3021,8,0x3038)
config = ptr(); count = integer()
assert choose(display, attrs, C.byref(config), 1, C.byref(count)) and count.value
surface = create_surface(display, config, (integer * 5)(0x3057,1280,0x3056,900,0x3038))
context = create_context(display, config, None, (integer * 3)(0x3098,2,0x3038))
assert surface and context and make_current(display, surface, surface, context)
create_shader = gl('glCreateShader', uint, uint)
shader_source = gl('glShaderSource', None, uint, integer, C.POINTER(C.c_char_p), C.POINTER(integer))
compile_shader = gl('glCompileShader', None, uint)
get_shader = gl('glGetShaderiv', None, uint, uint, C.POINTER(integer))
get_log = gl('glGetShaderInfoLog', None, uint, integer, C.POINTER(integer), C.c_char_p)
def compile_one(kind, source):
    shader = create_shader(kind); src = C.c_char_p(source.encode()); shader_source(shader, 1, C.byref(src), None); compile_shader(shader)
    ok=integer(); get_shader(shader,0x8B81,C.byref(ok)); log=C.create_string_buffer(4096);get_log(shader,4096,None,log)
    assert ok.value, log.value.decode(); return shader
program=gl('glCreateProgram',uint)()
attach=gl('glAttachShader',None,uint,uint)
attach(program,compile_one(0x8B31,data['vertex']));attach(program,compile_one(0x8B30,data['fragment']))
gl('glLinkProgram',None,uint)(program); ok=integer();gl('glGetProgramiv',None,uint,uint,C.POINTER(integer))(program,0x8B82,C.byref(ok));assert ok.value
gl('glUseProgram',None,uint)(program)
loc=gl('glGetUniformLocation',integer,uint,C.c_char_p)
gl('glUniformMatrix4fv',None,integer,integer,C.c_ubyte,C.POINTER(floating))(loc(program,b'uMatrix'),1,0,(floating*16)(*data['matrix']))
gl('glUniform3fv',None,integer,integer,C.POINTER(floating))(loc(program,b'uEye'),1,(floating*3)(*data['eye']))
gl('glViewport',None,integer,integer,integer,integer)(0,0,1280,900)
gl('glEnable',None,uint)(0x0B71);gl('glClearColor',None,floating,floating,floating,floating)(.035,.064,.090,1);gl('glClear',None,uint)(0x4000|0x100)
buffer=uint();gl('glGenBuffers',None,integer,C.POINTER(uint))(1,C.byref(buffer));gl('glBindBuffer',None,uint,uint)(0x8892,buffer)
attrib=gl('glGetAttribLocation',integer,uint,C.c_char_p)
for i,name in enumerate([b'aPosition',b'aNormal',b'aColor']):
    location=attrib(program,name);gl('glEnableVertexAttribArray',None,uint)(location);gl('glVertexAttribPointer',None,uint,integer,uint,C.c_ubyte,integer,ptr)(location,3,0x1406,0,36,ptr(i*12))
for i,arr in enumerate(data['arrays']):
    raw=(floating*len(arr))(*arr);gl('glBufferData',None,uint,C.c_ssize_t,ptr,uint)(0x8892,C.sizeof(raw),C.cast(raw,ptr),0x88E4);gl('glDrawArrays',None,uint,integer,integer)(1 if i%2 else 4,0,len(arr)//9)
pixels=(C.c_ubyte*(1280*900*4))();gl('glReadPixels',None,integer,integer,integer,integer,uint,uint,ptr)(0,0,1280,900,0x1908,0x1401,C.cast(pixels,ptr))
error=gl('glGetError',uint)();assert error==0,hex(error)
out=root/'world3d'/'preview.png'
Image.frombytes('RGBA',(1280,900),bytes(pixels)).transpose(Image.Transpose.FLIP_TOP_BOTTOM).convert('RGB').save(out)
print(json.dumps({'renderer':gl('glGetString',C.c_char_p,uint)(0x1F01).decode(),'gl_error':error,'shader_compile':'passed','world_checksum':data['checksum'],'scene_capture':str(out),'browser_review':False}))
