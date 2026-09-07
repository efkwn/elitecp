package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type SystemSnapshot struct {
	Hostname      string    `json:"hostname"`
	OS            string    `json:"os"`
	CPUCores      int       `json:"cpu_cores"`
	CPUPercent    float64   `json:"cpu_percent"`
	Load1         float64   `json:"load_1"`
	Load5         float64   `json:"load_5"`
	Load15        float64   `json:"load_15"`
	MemoryTotal   uint64    `json:"memory_total_bytes"`
	MemoryUsed    uint64    `json:"memory_used_bytes"`
	MemoryAvail   uint64    `json:"memory_available_bytes"`
	MemoryPercent float64   `json:"memory_percent"`
	DiskPath      string    `json:"disk_path"`
	DiskTotal     uint64    `json:"disk_total_bytes"`
	DiskUsed      uint64    `json:"disk_used_bytes"`
	DiskAvail     uint64    `json:"disk_available_bytes"`
	DiskPercent   float64   `json:"disk_percent"`
	UptimeSeconds uint64    `json:"uptime_seconds"`
	CollectedAt   time.Time `json:"collected_at"`
}

type cpuTimes struct {
	idle  uint64
	total uint64
}

func collectSystemSnapshot(diskPath string) (SystemSnapshot, error) {
	hostname, _ := os.Hostname()
	if diskPath == "" {
		diskPath = "/"
	}

	first, err := readCPUTimes()
	if err != nil {
		return SystemSnapshot{}, err
	}
	time.Sleep(120 * time.Millisecond)
	second, err := readCPUTimes()
	if err != nil {
		return SystemSnapshot{}, err
	}

	memTotal, memAvail, err := readMemoryBytes()
	if err != nil {
		return SystemSnapshot{}, err
	}
	memUsed := uint64(0)
	if memTotal > memAvail {
		memUsed = memTotal - memAvail
	}

	diskTotal, diskAvail, err := readDiskBytes(diskPath)
	if err != nil {
		return SystemSnapshot{}, err
	}
	diskUsed := uint64(0)
	if diskTotal > diskAvail {
		diskUsed = diskTotal - diskAvail
	}

	uptime, _ := readUptimeSeconds()
	load1, load5, load15, _ := readLoadAverage()

	return SystemSnapshot{
		Hostname:      hostname,
		OS:            readPrettyOSName(),
		CPUCores:      runtime.NumCPU(),
		CPUPercent:    cpuPercent(first, second),
		Load1:         load1,
		Load5:         load5,
		Load15:        load15,
		MemoryTotal:   memTotal,
		MemoryUsed:    memUsed,
		MemoryAvail:   memAvail,
		MemoryPercent: percent(memUsed, memTotal),
		DiskPath:      diskPath,
		DiskTotal:     diskTotal,
		DiskUsed:      diskUsed,
		DiskAvail:     diskAvail,
		DiskPercent:   percent(diskUsed, diskTotal),
		UptimeSeconds: uptime,
		CollectedAt:   time.Now().UTC(),
	}, nil
}

func readCPUTimes() (cpuTimes, error) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return cpuTimes{}, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	if !scanner.Scan() {
		return cpuTimes{}, errors.New("/proc/stat is empty")
	}
	fields := strings.Fields(scanner.Text())
	if len(fields) < 5 || fields[0] != "cpu" {
		return cpuTimes{}, errors.New("unexpected /proc/stat format")
	}

	vals := make([]uint64, 0, len(fields)-1)
	for _, field := range fields[1:] {
		v, err := strconv.ParseUint(field, 10, 64)
		if err != nil {
			return cpuTimes{}, fmt.Errorf("parse /proc/stat: %w", err)
		}
		vals = append(vals, v)
	}
	for len(vals) < 8 {
		vals = append(vals, 0)
	}

	idle := vals[3] + vals[4]
	nonIdle := vals[0] + vals[1] + vals[2] + vals[5] + vals[6] + vals[7]
	return cpuTimes{idle: idle, total: idle + nonIdle}, nil
}

func cpuPercent(a, b cpuTimes) float64 {
	if b.total <= a.total {
		return 0
	}
	totalDelta := b.total - a.total
	idleDelta := uint64(0)
	if b.idle > a.idle {
		idleDelta = b.idle - a.idle
	}
	busy := totalDelta - minUint64(idleDelta, totalDelta)
	return clampPercent(float64(busy) / float64(totalDelta) * 100)
}

func readMemoryBytes() (total uint64, available uint64, err error) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()

	values := map[string]uint64{}
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}
		key := strings.TrimSuffix(fields[0], ":")
		v, parseErr := strconv.ParseUint(fields[1], 10, 64)
		if parseErr != nil {
			continue
		}
		values[key] = v * 1024
	}
	if err := scanner.Err(); err != nil {
		return 0, 0, err
	}
	total = values["MemTotal"]
	available = values["MemAvailable"]
	if available == 0 {
		available = values["MemFree"] + values["Buffers"] + values["Cached"]
	}
	if total == 0 {
		return 0, 0, errors.New("MemTotal not found")
	}
	if available > total {
		available = total
	}
	return total, available, nil
}

func readDiskBytes(path string) (total uint64, available uint64, err error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, 0, err
	}
	blockSize := uint64(stat.Bsize)
	return uint64(stat.Blocks) * blockSize, uint64(stat.Bavail) * blockSize, nil
}

func readUptimeSeconds() (uint64, error) {
	b, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0, err
	}
	fields := strings.Fields(string(b))
	if len(fields) == 0 {
		return 0, errors.New("unexpected /proc/uptime format")
	}
	seconds, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0, err
	}
	if seconds < 0 {
		return 0, nil
	}
	return uint64(seconds), nil
}

func readLoadAverage() (float64, float64, float64, error) {
	b, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0, 0, 0, err
	}
	fields := strings.Fields(string(b))
	if len(fields) < 3 {
		return 0, 0, 0, errors.New("unexpected /proc/loadavg format")
	}
	one, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0, 0, 0, err
	}
	five, err := strconv.ParseFloat(fields[1], 64)
	if err != nil {
		return 0, 0, 0, err
	}
	fifteen, err := strconv.ParseFloat(fields[2], 64)
	if err != nil {
		return 0, 0, 0, err
	}
	return one, five, fifteen, nil
}

func readPrettyOSName() string {
	b, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return "Linux"
	}
	for _, line := range strings.Split(string(b), "\n") {
		if strings.HasPrefix(line, "PRETTY_NAME=") {
			v := strings.TrimPrefix(line, "PRETTY_NAME=")
			v = strings.Trim(v, `"'`)
			if v != "" {
				return v
			}
		}
	}
	return "Linux"
}

func percent(used, total uint64) float64 {
	if total == 0 {
		return 0
	}
	return clampPercent(float64(used) / float64(total) * 100)
}

func clampPercent(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 100 {
		return 100
	}
	return v
}

func minUint64(a, b uint64) uint64 {
	if a < b {
		return a
	}
	return b
}
