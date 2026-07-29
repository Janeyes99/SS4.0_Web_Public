#!/bin/zsh
cd "$(dirname "$0")"

PORT="${PORT:-3367}"
VIDEO_DIR="${VIDEO_DIR:-$HOME/Desktop/SS4.0_Web/video}"

if [ ! -d "$VIDEO_DIR" ]; then
  echo "未找到视频文件夹：$VIDEO_DIR"
  echo "请将视频放到：/Users/用户名/Desktop/SS4.0_Web/video"
  echo ""
  read "REPLY?按回车退出..."
  exit 1
fi

if ! command -v ruby >/dev/null 2>&1; then
  echo "未找到 ruby。该版本不需要 Python，但需要 macOS 自带的 ruby。"
  echo "请确认系统是否完整安装，或联系开发人员提供免脚本 App 版本。"
  echo ""
  read "REPLY?按回车退出..."
  exit 1
fi

ruby - "$VIDEO_DIR" "$PORT" <<'RUBY'
# encoding: UTF-8
require 'socket'
require 'uri'

VIDEO_DIR = File.expand_path(ARGV[0])
PORT = ARGV[1].to_i
CHUNK_SIZE = 1024 * 1024

MIME_TYPES = {
  '.mp4' => 'video/mp4',
  '.m4v' => 'video/mp4',
  '.mov' => 'video/quicktime',
  '.webm' => 'video/webm',
  '.html' => 'text/html; charset=utf-8',
  '.txt' => 'text/plain; charset=utf-8'
}

def write_response(socket, status, reason, headers = {}, body = nil)
  body ||= ''.b
  socket.write("HTTP/1.1 #{status} #{reason}\r\n")
  default_headers = {
    'Access-Control-Allow-Origin' => '*',
    'Access-Control-Allow-Methods' => 'GET, OPTIONS',
    'Access-Control-Allow-Headers' => 'Range, Content-Type, Access-Control-Request-Private-Network',
    'Access-Control-Allow-Private-Network' => 'true',
    'Accept-Ranges' => 'bytes',
    'Connection' => 'close'
  }
  default_headers.merge(headers).each do |key, value|
    socket.write("#{key}: #{value}\r\n")
  end
  socket.write("\r\n")
  socket.write(body) unless body.empty?
end

def send_error(socket, status, message)
  body = "#{status} #{message}\n".b
  write_response(socket, status, message, {
    'Content-Type' => 'text/plain; charset=utf-8',
    'Content-Length' => body.bytesize
  }, body)
end

def safe_video_path(path)
  return nil unless path.start_with?('/video/')

  raw_name = path.sub(%r{\A/video/}, '')
  file_name = File.basename(URI.decode_www_form_component(raw_name))
  file_path = File.expand_path(File.join(VIDEO_DIR, file_name))
  root = VIDEO_DIR.end_with?(File::SEPARATOR) ? VIDEO_DIR : VIDEO_DIR + File::SEPARATOR

  return nil unless file_path.start_with?(root)
  return nil unless File.file?(file_path)

  file_path
end

def handle_client(socket)
  request_line = socket.gets
  return unless request_line

  method, target, _version = request_line.split(' ', 3)
  headers = {}

  while (line = socket.gets)
    line = line.chomp
    break if line.empty?
    key, value = line.split(':', 2)
    headers[key.downcase] = value.strip if key && value
  end

  if method == 'OPTIONS'
    write_response(socket, 204, 'No Content', { 'Content-Length' => '0' })
    return
  end

  unless method == 'GET'
    send_error(socket, 405, 'Method Not Allowed')
    return
  end

  path = target.to_s.split('?', 2).first
  file_path = safe_video_path(path)
  unless file_path
    send_error(socket, 404, 'Video Not Found')
    return
  end

  file_size = File.size(file_path)
  start_byte = 0
  end_byte = file_size - 1
  status = 200
  reason = 'OK'

  range_header = headers['range']
  if range_header && range_header.start_with?('bytes=')
    range_value = range_header.sub('bytes=', '').split(',', 2).first.strip
    left, right = range_value.split('-', 2)
    start_byte = left.to_i unless left.nil? || left.empty?
    end_byte = right.to_i unless right.nil? || right.empty?
    start_byte = [[start_byte, 0].max, file_size - 1].min
    end_byte = [[end_byte, start_byte].max, file_size - 1].min
    status = 206
    reason = 'Partial Content'
  end

  length = end_byte - start_byte + 1
  ext = File.extname(file_path).downcase
  content_type = MIME_TYPES[ext] || 'application/octet-stream'
  response_headers = {
    'Content-Type' => content_type,
    'Content-Length' => length.to_s
  }
  response_headers['Content-Range'] = "bytes #{start_byte}-#{end_byte}/#{file_size}" if status == 206

  socket.write("HTTP/1.1 #{status} #{reason}\r\n")
  {
    'Access-Control-Allow-Origin' => '*',
    'Access-Control-Allow-Methods' => 'GET, OPTIONS',
    'Access-Control-Allow-Headers' => 'Range, Content-Type, Access-Control-Request-Private-Network',
    'Access-Control-Allow-Private-Network' => 'true',
    'Accept-Ranges' => 'bytes',
    'Connection' => 'close'
  }.merge(response_headers).each do |key, value|
    socket.write("#{key}: #{value}\r\n")
  end
  socket.write("\r\n")

  File.open(file_path, 'rb') do |file|
    file.seek(start_byte)
    remaining = length
    while remaining > 0
      data = file.read([CHUNK_SIZE, remaining].min)
      break unless data
      socket.write(data)
      remaining -= data.bytesize
    end
  end
rescue Errno::EPIPE, IOError
rescue => error
  begin
    send_error(socket, 500, error.message)
  rescue
  end
ensure
  begin
    socket.close
  rescue
  end
end

server = TCPServer.new('127.0.0.1', PORT)
puts ''
puts 'SS4.0 本地视频服务已启动（无 Python 版本）'
puts "视频目录: #{VIDEO_DIR}"
puts "服务地址: http://127.0.0.1:#{PORT}/video/"
puts ''
puts '请保持此窗口打开。关闭窗口即可停止本地视频服务。'
puts ''

loop do
  client = server.accept
  Thread.new(client) { |socket| handle_client(socket) }
end
RUBY
