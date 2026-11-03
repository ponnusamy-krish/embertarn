import struct,zlib
def valid_png(path,width=1920,height=1080):
 try:
  with open(path,'rb') as f:
   if f.read(8)!=b'\x89PNG\r\n\x1a\n':return False
   inflater=zlib.decompressobj();decoded=0;found=False
   while True:
    head=f.read(8)
    if len(head)!=8:return False
    n,tag=struct.unpack('>I4s',head);data=f.read(n);crc=f.read(4)
    if len(data)!=n or len(crc)!=4 or zlib.crc32(tag+data)&0xffffffff!=struct.unpack('>I',crc)[0]:return False
    if tag==b'IHDR':
     w,h,depth,color=struct.unpack('>IIBB',data[:10]);channels={2:3,6:4}.get(color,0)
     if (w,h)!=(width,height) or depth not in (8,16) or not channels:return False
    if tag==b'IDAT':decoded+=len(inflater.decompress(data));found=True
    if tag==b'IEND':return found and inflater.eof and decoded==height*(1+width*channels*depth//8)
 except (OSError,ValueError,zlib.error,struct.error):return False
