FROM i386/alpine:edge

# Bootstrap the system
ENV KERNEL=virt
RUN apk add openrc alpine-base agetty alpine-conf linux-$KERNEL linux-firmware-none sudo
RUN sed -i 's/getty 38400 tty1/agetty --autologin root tty1 linux/' /etc/inittab
RUN echo 'ttyS0::respawn:/sbin/agetty --autologin root -s ttyS0 115200 vt100' >> /etc/inittab
RUN echo "root:" | chpasswd
RUN for i in devfs dmesg mdev hwdrivers; do rc-update add $i sysinit; done
RUN for i in hwclock modules sysctl hostname syslog bootmisc; do rc-update add $i boot; done
RUN rc-update add killprocs shutdown
RUN mkinitfs -F "base virtio 9p" $(cat /usr/share/kernel/$KERNEL/kernel.release)

# Set up the user
RUN echo -e "hunter2\nhunter2" | adduser me
RUN adduser me wheel
RUN echo "%wheel ALL=(ALL:ALL) ALL" >> /etc/sudoers

# Set up the environment
RUN apk add vim bash gcc musl-dev

