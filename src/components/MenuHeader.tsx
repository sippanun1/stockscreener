import { Button, Navbar, NavbarBrand } from "flowbite-react";
import goodtradeLogo from "../assets/goodtrade.svg";

export default function MenuHeader() {
  return (
    <Navbar className="pl-[53px] pr-[53px]">
      <NavbarBrand href="/">
        <img
          src={goodtradeLogo}
          className="w-[97px] h-[97px]pl-[53px]"
        />
      </NavbarBrand>
      <div className="flex justify-end px-6">
        <Button className="text-[#F8FAFC] hover:text-[#00FF88] w-[83px] h-[36px]">Screener</Button>
        <Button className="text-[#F8FAFC] hover:text-[#00FF88] w-[83px] h-[36px]">Analytics</Button>
      </div>
    </Navbar>
  );
}
